package org.jortvanschijndel.resourcepackmanager;

import org.bukkit.plugin.java.JavaPlugin;
import java.io.File;

public class ResourcepackManager extends JavaPlugin {

    private HttpServer httpServer;
    private static ResourcepackManager instance;
    private boolean debugEnabled = false;

    @Override
    public void onEnable() {
        instance = this;
        saveDefaultConfig();

        // Start the embedded HTTP server
        try {
            httpServer = new HttpServer(this);
            httpServer.start();
            getLogger().info("HTTP server started on port " + getConfig().getInt("port", 8080));
        } catch (Exception e) {
            getLogger().severe("Failed to start HTTP server: " + e.getMessage());
            e.printStackTrace();
        }

        // Register commands
        CommandManager commandManager = new CommandManager(this);
        getCommand("rp-reload").setExecutor(commandManager);
        getCommand("rp-status").setExecutor(commandManager);
        getCommand("rp-seturl").setExecutor(commandManager);
        getCommand("rp-debug").setExecutor(commandManager);

        // Register listener
        getServer().getPluginManager().registerEvents(new PlayerJoinListener(this), this);

        getLogger().info("ResourcepackManager has been enabled.");
    }

    @Override
    public void onDisable() {
        if (httpServer != null) {
            httpServer.stop();
            getLogger().info("HTTP server stopped.");
        }
        getLogger().info("ResourcepackManager has been disabled.");
    }

    public static ResourcepackManager getInstance() {
        return instance;
    }

    public File getResourcePackDir() {
        File dir = new File(getDataFolder(), "resourcepacks");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    public boolean isDebugEnabled() {
        return debugEnabled;
    }

    public void setDebugEnabled(boolean debugEnabled) {
        this.debugEnabled = debugEnabled;
    }
}