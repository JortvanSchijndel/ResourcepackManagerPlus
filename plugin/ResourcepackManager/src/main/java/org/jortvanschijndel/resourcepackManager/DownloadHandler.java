package org.jortvanschijndel.resourcepackManager;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.File;
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
        File activePack = plugin.getActivePack();
        if (activePack == null || !activePack.exists()) {
            exchange.sendResponseHeaders(404, -1); // Not Found
            return;
        }

        exchange.sendResponseHeaders(200, activePack.length());
        try (OutputStream os = exchange.getResponseBody()) {
            Files.copy(activePack.toPath(), os);
        }
    }
}
