package org.jortvanschijndel.resourcepackManager;

import org.bukkit.command.PluginCommand;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class ResourcepackManager extends JavaPlugin {

    private FileConfiguration config;
    private HttpServer httpServer;
    private File activePack;
    private boolean debugEnabled;
    private ResourcePackInspector packInspector;
    private final Map<String, UUID> tokenMap = new ConcurrentHashMap<>();

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
        // Also reinspect the pack on reload
        loadActivePack();
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
            } else {
                getLogger().warning("No resource packs found in the 'packs' folder.");
                activePack = null;
                packInspector.inspect(null); // Clear old models
            }
        } else {
             getLogger().warning("Packs folder does not exist.");
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
}
