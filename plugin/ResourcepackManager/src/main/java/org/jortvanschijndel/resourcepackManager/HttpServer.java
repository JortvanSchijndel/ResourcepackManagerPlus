package org.jortvanschijndel.resourcepackManager;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

public class HttpServer {

    private final ResourcepackManager plugin;
    private com.sun.net.httpserver.HttpServer server;

    public HttpServer(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    public synchronized void start() {
        // If server is not null, it might be running. Stop it to ensure a clean start.
        if (server != null) {
            stop();
        }
        try {
            int port = plugin.getConfig().getInt("port");
            server = com.sun.net.httpserver.HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/heartbeat", new HeartbeatHandler(plugin));
            server.createContext("/upload", new UploadHandler(plugin));
            server.createContext("/pack.zip", new DownloadHandler(plugin));
            server.createContext("/watchdog", new WatchdogHandler()); // Add watchdog endpoint
            server.createContext("/pack/", new PublicPackHandler(plugin)); // Add public pack endpoint
            server.setExecutor(Executors.newSingleThreadExecutor());
            server.start();
            plugin.getLogger().info("HTTP server started on port " + port);
        } catch (IOException e) {
            plugin.getLogger().severe("Could not start HTTP server: " + e.getMessage());
            server = null; // Ensure server is null on failure
        }
    }

    public synchronized void stop() {
        if (server != null) {
            server.stop(0);
            plugin.getLogger().info("HTTP server stopped.");
            server = null;
        }
    }

    static class HeartbeatHandler implements HttpHandler {
        private final ResourcepackManager plugin;

        public HeartbeatHandler(ResourcepackManager plugin) {
            this.plugin = plugin;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (plugin.isDebugEnabled()) {
                plugin.getLogger().info("[Debug] Received heartbeat request from " + exchange.getRemoteAddress());
            }

            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1); // Method Not Allowed
                return;
            }
            String response = "{\"status\":\"alive\"}";
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        }
    }

    static class WatchdogHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            byte[] response = "OK".getBytes();
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        }
    }
}
