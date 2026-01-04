package org.jortvanschijndel.resourcepackManager;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
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
            plugin.getLogger().info("[Debug] Received upload request from " + exchange.getRemoteAddress());
        }

        if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
            exchange.sendResponseHeaders(405, -1); // Method Not Allowed
            return;
        }

        String apiKey = exchange.getRequestHeaders().getFirst("X-API-Key");
        String expectedApiKey = plugin.getConfig().getString("api-key");
        if (apiKey == null || !apiKey.equals(expectedApiKey)) {
            exchange.sendResponseHeaders(401, -1); // Unauthorized
            return;
        }

        String allowedUrl = plugin.getConfig().getString("allowed-url");
        if (allowedUrl != null && !allowedUrl.isEmpty()) {
            String originHeader = exchange.getRequestHeaders().getFirst("Origin");
            if (originHeader == null) {
                originHeader = exchange.getRequestHeaders().getFirst("Referer");
            }

            if (plugin.isDebugEnabled()) {
                plugin.getLogger().info("[Debug] Origin/Referer Header: " + originHeader);
                plugin.getLogger().info("[Debug] Allowed URL from config: " + allowedUrl);
            }

            if (originHeader == null) {
                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().warning("[Debug] Forbidden: Origin and Referer headers are both missing.");
                }
                exchange.sendResponseHeaders(403, -1); // Forbidden
                return;
            }

            try {
                URI originUri = new URI(originHeader);
                String originHost = originUri.getHost();

                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().info("[Debug] Parsed Origin Host: " + originHost);
                }

                // Allow if hosts are identical.
                if (originHost == null || !originHost.equalsIgnoreCase(allowedUrl)) {
                     if (plugin.isDebugEnabled()) {
                        plugin.getLogger().warning("[Debug] Forbidden: Origin host '" + originHost + "' does not match allowed URL '" + allowedUrl + "'.");
                    }
                    exchange.sendResponseHeaders(403, -1); // Forbidden
                    return;
                }
            } catch (URISyntaxException e) {
                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().warning("[Debug] Forbidden: Could not parse Origin/Referer header: " + originHeader);
                }
                exchange.sendResponseHeaders(403, -1); // Forbidden
                return;
            }
        }


        try (InputStream inputStream = exchange.getRequestBody()) {
            File packsFolder = new File(plugin.getDataFolder(), "packs");
            if (!packsFolder.exists()) {
                if (!packsFolder.mkdirs()) {
                    plugin.getLogger().warning("Could not create packs directory.");
                }
            }

            File newPack = new File(packsFolder, "pack-" + System.currentTimeMillis() + ".zip");
            try (FileOutputStream outputStream = new FileOutputStream(newPack)) {
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
            }

            plugin.setActivePack(newPack);
            managePackHistory(packsFolder);

            String response = "Resource pack uploaded successfully.";
            exchange.sendResponseHeaders(200, response.length());
            exchange.getResponseBody().write(response.getBytes());

            Bukkit.getScheduler().runTask(plugin, () ->
                    Bukkit.broadcast(Component.text("A new resource pack is available! Please rejoin the server to apply it."))
            );

        } catch (IOException e) {
            plugin.getLogger().severe("Error handling file upload: " + e.getMessage());
            String response = "Internal server error.";
            exchange.sendResponseHeaders(500, response.length());
            exchange.getResponseBody().write(response.getBytes());
        } finally {
            exchange.close();
        }
    }

    private void managePackHistory(File packsFolder) {
        File[] files = packsFolder.listFiles((dir, name) -> name.endsWith(".zip"));
        if (files != null && files.length > 5) {
            Arrays.sort(files, Comparator.comparingLong(File::lastModified));
            for (int i = 0; i < files.length - 5; i++) {
                if (!files[i].getName().equals(plugin.getActivePack().getName())) {
                    if (!files[i].delete()) {
                        plugin.getLogger().warning("Could not delete old resource pack: " + files[i].getName());
                    }
                }
            }
        }
    }
}
