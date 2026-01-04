package org.jortvanschijndel.resourcepackmanager;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;

public class DownloadHandler implements HttpHandler {

    private final ResourcepackManager plugin;

    public DownloadHandler(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(405, -1); // Method Not Allowed
            return;
        }

        File packFile = new File(plugin.getResourcePackDir(), "pack.zip");
        if (!packFile.exists()) {
            // Try to serve the most recent historical pack if active one is missing
            packFile = getMostRecentPack();
        }

        if (packFile == null || !packFile.exists()) {
            exchange.sendResponseHeaders(404, -1); // Not Found
            return;
        }

        exchange.getResponseHeaders().set("Content-Type", "application/zip");
        exchange.sendResponseHeaders(200, packFile.length());

        try (OutputStream os = exchange.getResponseBody();
             FileInputStream fis = new FileInputStream(packFile)) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                os.write(buffer, 0, bytesRead);
            }
        }
    }

    private File getMostRecentPack() {
        File[] history = plugin.getResourcePackDir().listFiles((dir, name) -> name.startsWith("pack-") && name.endsWith(".zip"));
        if (history == null || history.length == 0) {
            return null;
        }

        File mostRecent = null;
        long lastMod = Long.MIN_VALUE;
        for (File file : history) {
            if (file.lastModified() > lastMod) {
                mostRecent = file;
                lastMod = file.lastModified();
            }
        }
        return mostRecent;
    }
}