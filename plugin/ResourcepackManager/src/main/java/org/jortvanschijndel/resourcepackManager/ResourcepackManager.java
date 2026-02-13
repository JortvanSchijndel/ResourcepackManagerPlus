package org.jortvanschijndel.resourcepackManager;

import org.bukkit.command.PluginCommand;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.io.File;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class ResourcepackManager extends JavaPlugin {

    private FileConfiguration config;
    private HttpServer httpServer;
    private File activePack;
    private boolean debugEnabled;
    private ResourcePackInspector packInspector;
    private final Map<String, UUID> tokenMap = new ConcurrentHashMap<>();
    private BukkitRunnable watchdogTask;

    @Override
    public void onEnable() {
        // Configuration
        saveDefaultConfig();
        config = getConfig();
        reloadConfig();
        debugEnabled = config.getBoolean("debug", false);

        // Start web server
        httpServer = new HttpServer(this);
        httpServer.start();

        // Start watchdog task
        startWatchdog();

        // Load active pack
        packInspector = new ResourcePackInspector(this);
        loadActivePack();

        // Register listener
        getServer().getPluginManager().registerEvents(new PlayerJoinListener(this), this);

        // Register commands
        CommandManager commandManager = new CommandManager(this);
        
        PluginCommand rmpCommand = getCommand("rmp");
        if (rmpCommand != null) {
            rmpCommand.setExecutor(commandManager);
            rmpCommand.setTabCompleter(commandManager);
        }

        PluginCommand giveModelCommand = getCommand("give-model");
        if (giveModelCommand != null) {
            giveModelCommand.setExecutor(commandManager);
            giveModelCommand.setTabCompleter(commandManager);
        }

        PluginCommand modelsCommand = getCommand("models");
        if (modelsCommand != null) {
            modelsCommand.setExecutor(commandManager);
            modelsCommand.setTabCompleter(commandManager);
        }
    }

    @Override
    public void onDisable() {
        if (watchdogTask != null) {
            watchdogTask.cancel();
        }
        if (httpServer != null) {
            httpServer.stop();
        }
    }

    public void reloadPluginConfig() {
        reloadConfig();
        config = getConfig();
        debugEnabled = config.getBoolean("debug", false);
        if (httpServer != null) {
            httpServer.stop();
            httpServer = new HttpServer(this);
            httpServer.start();
        }
    }

    public File getActivePack() {
        return activePack;
    }

    public void setActivePack(File activePack) {
        this.activePack = activePack;
        if (activePack != null) {
            packInspector.inspect(activePack);
        }
    }

    public boolean isDebugEnabled() {
        return debugEnabled;
    }

    public void setDebugEnabled(boolean debugEnabled) {
        this.debugEnabled = debugEnabled;
        getConfig().set("debug", debugEnabled);
        saveConfig();
    }
    
    public ResourcePackInspector getPackInspector() {
        return packInspector;
    }

    private void loadActivePack() {
        File packsFolder = new File(getDataFolder(), "packs");
        if (packsFolder.exists()) {
            File[] files = packsFolder.listFiles((dir, name) -> name.endsWith(".zip"));
            if (files != null && files.length > 0) {
                Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
                activePack = files[0];
                getLogger().info("Loaded active resource pack: " + activePack.getName());
                packInspector.inspect(activePack);
            }
        }
    }

    public String generateToken(UUID playerUuid) {
        String token = UUID.randomUUID().toString();
        tokenMap.put(token, playerUuid);
        // Expire token after 5 minutes
        getServer().getScheduler().runTaskLater(this, () -> tokenMap.remove(token), 20L * 60 * 5);
        return token;
    }

    public boolean validateToken(String token) {
        return tokenMap.containsKey(token);
    }

    private void startWatchdog() {
        watchdogTask = new BukkitRunnable() {
            @Override
            public void run() {
                checkServerHealth();
            }
        };
        // Run every 5 minutes (6000 ticks)
        watchdogTask.runTaskTimerAsynchronously(this, 6000L, 6000L);
    }

    private void checkServerHealth() {
        int port = getConfig().getInt("port");
        String urlString = "http://127.0.0.1:" + port + "/watchdog";
        try {
            URL url = new URL(urlString);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(2000); // 2 seconds timeout
            connection.setReadTimeout(2000);

            int responseCode = connection.getResponseCode();
            if (responseCode != 200) {
                getLogger().warning("HTTP server watchdog failed (Response: " + responseCode + "). Restarting server...");
                restartHttpServer();
            }
        } catch (IOException e) {
            getLogger().warning("HTTP server watchdog failed (" + e.getMessage() + "). Restarting server...");
            restartHttpServer();
        }
    }

    private void restartHttpServer() {
        // Restart on main thread to be safe
        getServer().getScheduler().runTask(this, () -> {
            if (httpServer != null) {
                httpServer.stop();
            }
            httpServer = new HttpServer(this);
            httpServer.start();
            getLogger().info("HTTP server restarted by watchdog.");
        });
    }
}
