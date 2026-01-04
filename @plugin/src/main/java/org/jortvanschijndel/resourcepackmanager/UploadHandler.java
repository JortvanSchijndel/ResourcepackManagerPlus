package org.jortvanschijndel.resourcepackmanager;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.bukkit.Bukkit;

import java.io.*;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;

public class UploadHandler implements HttpHandler {

    private final ResourcepackManager plugin;

    public UploadHandler(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (plugin.isDebugEnabled()) {
            plugin.getLogger().info("[Debug] Received " + exchange.getRequestMethod() + " request for /upload from " + exchange.getRemoteAddress());
        }

        if (!"POST".equals(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
            return;
        }

        String apiKey = exchange.getRequestHeaders().getFirst("X-API-Key");
        String expectedApiKey = plugin.getConfig().getString("api-key");
        if (expectedApiKey == null || expectedApiKey.isEmpty() || !expectedApiKey.equals(apiKey)) {
            if (plugin.isDebugEnabled()) {
                plugin.getLogger().warning("[Debug] Unauthorized upload attempt: Invalid API Key.");
            }
            sendResponse(exchange, 401, "{\"error\":\"Unauthorized\"}");
            return;
        }

        String allowedUrl = plugin.getConfig().getString("allowed-url", "");
        if (allowedUrl != null && !allowedUrl.isEmpty()) {
            String remoteHost = exchange.getRemoteAddress().getAddress().getHostAddress();
            String allowedHost = allowedUrl;

            if (allowedHost.contains("://")) {
                allowedHost = allowedHost.substring(allowedHost.indexOf("://") + 3);
            }
            if (allowedHost.contains(":")) {
                allowedHost = allowedHost.substring(0, allowedHost.indexOf(":"));
            }
            if (allowedHost.contains("/")) {
                allowedHost = allowedHost.substring(0, allowedHost.indexOf("/"));
            }

            if (!remoteHost.equals(allowedHost)) {
                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().warning("[Debug] Forbidden upload attempt from host: " + remoteHost + ". Allowed host: " + allowedHost);
                }
                sendResponse(exchange, 403, "{\"error\":\"Forbidden: Host not allowed\"}");
                return;
            }
        }

        try (InputStream is = exchange.getRequestBody()) {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int length;
            while ((length = is.read(buffer)) != -1) {
                baos.write(buffer, 0, length);
            }
            byte[] fileBytes = baos.toByteArray();

            if (fileBytes.length == 0) {
                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().warning("[Debug] Bad request: Empty body received.");
                }
                sendResponse(exchange, 400, "{\"error\":\"Bad Request: Empty body\"}");
                return;
            }

            File packDir = plugin.getResourcePackDir();
            File newPack = new File(packDir, "pack.zip");

            managePackHistory(packDir);

            Files.write(newPack.toPath(), fileBytes);

            String sha1 = calculateSHA1(newPack);
            plugin.getConfig().set("active-pack-sha1", sha1);
            plugin.saveConfig();

            if (plugin.isDebugEnabled()) {
                plugin.getLogger().info("[Debug] Successfully saved new resource pack. SHA-1: " + sha1);
            }

            Bukkit.getScheduler().runTask(plugin, () -> {
                Bukkit.broadcastMessage("§aA new resource pack is available! Please rejoin to apply the changes.");
            });

            sendResponse(exchange, 200, "{\"status\":\"success\"}");

        } catch (Exception e) {
            plugin.getLogger().severe("Error during upload: " + e.getMessage());
            e.printStackTrace();
            sendResponse(exchange, 500, "{\"error\":\"Internal Server Error\"}");
        }
    }

    private void sendResponse(HttpExchange exchange, int code, String message) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(code, message.getBytes().length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(message.getBytes());
        }
    }

    private void managePackHistory(File packDir) {
        File currentPack = new File(packDir, "pack.zip");
        if (currentPack.exists()) {
            File dest = new File(packDir, "pack-" + System.currentTimeMillis() + ".zip");
            currentPack.renameTo(dest);
        }

        File[] history = packDir.listFiles((dir, name) -> name.startsWith("pack-") && name.endsWith(".zip"));
        if (history != null && history.length >= 5) {
            Arrays.sort(history, Comparator.comparingLong(File::lastModified));
            history[0].delete();
        }
    }

    private String calculateSHA1(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] byteArray = new byte[1024];
            int bytesCount;
            while ((bytesCount = fis.read(byteArray)) != -1) {
                digest.update(byteArray, 0, bytesCount);
            }
        }
        byte[] bytes = digest.digest();
        StringBuilder sb = new StringBuilder();
        for (byte aByte : bytes) {
            sb.append(Integer.toString((aByte & 0xff) + 0x100, 16).substring(1));
        }
        return sb.toString();
    }
}