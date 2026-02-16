package org.jortvanschijndel.resourcepackManager;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;

public class PublicPackHandler implements HttpHandler {

    private final ResourcepackManager plugin;

    public PublicPackHandler(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String packId = path.substring(path.lastIndexOf('/') + 1);

        if (plugin.isDebugEnabled()) {
            plugin.getLogger().info("Public pack request for ID: " + packId);
            plugin.getLogger().info("Expected pack ID: " + plugin.getPublicPackId());
        }

        if (!packId.equals(plugin.getPublicPackId())) {
            exchange.sendResponseHeaders(404, -1); // Not Found
            return;
        }

        File activePack = plugin.getActivePack();
        if (activePack == null || !activePack.exists()) {
            exchange.sendResponseHeaders(404, -1); // Not Found
            return;
        }

        exchange.getResponseHeaders().set("Content-Type", "application/zip");
        exchange.sendResponseHeaders(200, activePack.length());
        try (OutputStream os = exchange.getResponseBody()) {
            Files.copy(activePack.toPath(), os);
        }
    }
}
