package org.jortvanschijndel.resourcepackManager;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

public class DownloadHandler implements HttpHandler {

    private final ResourcepackManager plugin;

    public DownloadHandler(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        Map<String, String> params = queryToMap(query);
        String token = params.get("token");

        if (token == null || !plugin.validateToken(token)) {
            if (plugin.isDebugEnabled()) {
                plugin.getLogger().warning("Invalid or missing token for download request from " + exchange.getRemoteAddress());
            }
            exchange.sendResponseHeaders(403, -1); // Forbidden
            return;
        }

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

    private Map<String, String> queryToMap(String query) {
        Map<String, String> result = new HashMap<>();
        if (query == null) {
            return result;
        }
        for (String param : query.split("&")) {
            String[] entry = param.split("=");
            if (entry.length > 1) {
                result.put(entry[0], entry[1]);
            } else {
                result.put(entry[0], "");
            }
        }
        return result;
    }
}
