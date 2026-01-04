package org.jortvanschijndel.resourcepackManager;

import org.bukkit.command.PluginCommand;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.Arrays;
import java.util.Comparator;

public final class ResourcepackManager extends JavaPlugin {

    private FileConfiguration config;
    private HttpServer httpServer;
    private File activePack;
    private boolean debugEnabled;

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
        loadActivePack();

        // Register listener
        getServer().getPluginManager().registerEvents(new PlayerJoinListener(this), this);

        // Register commands
        CommandManager commandManager = new CommandManager(this);
        PluginCommand reloadCommand = getCommand("rp-reload");
        if (reloadCommand != null) {
            reloadCommand.setExecutor(commandManager);
        }
        PluginCommand statusCommand = getCommand("rp-status");
        if (statusCommand != null) {
            statusCommand.setExecutor(commandManager);
        }
        PluginCommand setUrlCommand = getCommand("rp-seturl");
        if (setUrlCommand != null) {
            setUrlCommand.setExecutor(commandManager);
        }
        PluginCommand debugCommand = getCommand("rp-debug");
        if (debugCommand != null) {
            debugCommand.setExecutor(commandManager);
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
    }

    public File getActivePack() {
        return activePack;
    }

    public void setActivePack(File activePack) {
        this.activePack = activePack;
    }

    public boolean isDebugEnabled() {
        return debugEnabled;
    }

    public void setDebugEnabled(boolean debugEnabled) {
        this.debugEnabled = debugEnabled;
        getConfig().set("debug", debugEnabled);
        saveConfig();
    }

    private void loadActivePack() {
        File packsFolder = new File(getDataFolder(), "packs");
        if (packsFolder.exists()) {
            File[] files = packsFolder.listFiles((dir, name) -> name.endsWith(".zip"));
            if (files != null && files.length > 0) {
                Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
                activePack = files[0];
                getLogger().info("Loaded active resource pack: " + activePack.getName());
            }
        }
    }
}
