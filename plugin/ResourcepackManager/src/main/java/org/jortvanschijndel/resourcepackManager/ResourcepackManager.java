package org.jortvanschijndel.resourcepackManager;

import org.bukkit.command.PluginCommand;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;
import org.jortvanschijndel.resourcepackManager.util.ServerPropertiesUtil;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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
    private String publicPackId;

    @Override
    public void onLoad() {
        // Configuration
        saveDefaultConfig();
        config = getConfig();
        debugEnabled = config.getBoolean("debug", false);

        // Load public pack ID
        getPublicPackId();

        // Load active pack early for the web server
        loadActivePack();

        // Start web server
        httpServer = new HttpServer(this);
        httpServer.start();
    }

    @Override
    public void onEnable() {
        // Start watchdog task
        startWatchdog();

        // Re-inspect pack if needed or just ensure inspector is ready
        if (packInspector == null) {
            packInspector = new ResourcePackInspector(this);
            if (activePack != null) {
                packInspector.inspect(activePack);
            }
        }

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
            // Generate a new ID for the new pack
            this.publicPackId = UUID.randomUUID().toString();
            getConfig().set("public-pack-id", this.publicPackId);
            saveConfig();

            if (packInspector == null) {
                packInspector = new ResourcePackInspector(this);
            }
            packInspector.inspect(activePack);
            updateServerProperties(activePack);
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
        if (packInspector == null) {
            packInspector = new ResourcePackInspector(this);
        }
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
                
                // We can't inspect yet if called from onLoad because inspector might need plugin fully initialized?
                // Actually inspector just reads file. But let's be safe.
                // However, updateServerProperties needs to run.
                
                if (packInspector == null) {
                    packInspector = new ResourcePackInspector(this);
                }
                packInspector.inspect(activePack);
                updateServerProperties(activePack);
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

    public String getPublicPackId() {
        if (publicPackId == null || publicPackId.isEmpty()) {
            publicPackId = getConfig().getString("public-pack-id");
            if (publicPackId == null || publicPackId.isEmpty()) {
                publicPackId = UUID.randomUUID().toString();
                getConfig().set("public-pack-id", publicPackId);
                saveConfig();
            }
        }
        return publicPackId;
    }

    private void updateServerProperties(File packFile) {
        try {
            File serverPropertiesFile = new File(getDataFolder().getParentFile().getParentFile(), "server.properties");
            if (!serverPropertiesFile.exists()) {
                getLogger().warning("Could not find server.properties at " + serverPropertiesFile.getAbsolutePath());
                return;
            }

            Properties props = ServerPropertiesUtil.load(serverPropertiesFile);
            
            String sha1 = calculateSHA1(packFile);
            String serverIp = getConfig().getString("server-ip");
            int port = getConfig().getInt("port");
            String url = "http://" + serverIp + ":" + port + "/pack/" + getPublicPackId();

            props.setProperty("resource-pack", url);
            props.setProperty("resource-pack-sha1", sha1);
            props.setProperty("resource-pack-id", getPublicPackId());

            ServerPropertiesUtil.save(serverPropertiesFile, props, StandardCharsets.UTF_8);
            getLogger().info("Updated server.properties with new resource pack URL and SHA1.");

        } catch (IOException | NoSuchAlgorithmException e) {
            getLogger().severe("Failed to update server.properties: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private String calculateSHA1(File file) throws IOException, NoSuchAlgorithmException {
        MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[1024];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                sha1.update(buffer, 0, bytesRead);
            }
        }
        byte[] hashBytes = sha1.digest();
        StringBuilder sb = new StringBuilder();
        for (byte b : hashBytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
