package org.jortvanschijndel.resourcepackManager;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.jetbrains.annotations.NotNull;

import java.io.File;

public class CommandManager implements CommandExecutor {

    private final ResourcepackManager plugin;

    public CommandManager(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, String @NotNull [] args) {
        switch (command.getName().toLowerCase()) {
            case "rp-reload" -> handleReload(sender);
            case "rp-status" -> handleStatus(sender);
            case "rp-seturl" -> handleSetUrl(sender, args);
            case "rp-debug" -> handleDebug(sender);
            default -> {
                return false;
            }
        }
        return true;
    }

    private void handleReload(CommandSender sender) {
        if (!sender.hasPermission("resourcepackmanager.reload")) {
            sender.sendMessage("You don't have permission to use this command.");
            return;
        }
        plugin.reloadPluginConfig();
        sender.sendMessage("ResourcepackManager configuration reloaded.");
    }

    private void handleStatus(CommandSender sender) {
        if (!sender.hasPermission("resourcepackmanager.status")) {
            sender.sendMessage("You don't have permission to use this command.");
            return;
        }
        sender.sendMessage("ResourcepackManager Status:");
        if (plugin.getActivePack() != null) {
            sender.sendMessage("Active pack: " + plugin.getActivePack().getName());
        } else {
            sender.sendMessage("No active pack.");
        }
        File packsFolder = new File(plugin.getDataFolder(), "packs");
        if (packsFolder.exists()) {
            File[] files = packsFolder.listFiles();
            if (files != null) {
                sender.sendMessage("Packs in history: " + files.length);
            } else {
                sender.sendMessage("Packs in history: 0");
            }
        } else {
            sender.sendMessage("Packs in history: 0");
        }
    }

    private void handleSetUrl(CommandSender sender, String[] args) {
        if (!sender.hasPermission("resourcepackmanager.seturl")) {
            sender.sendMessage("You don't have permission to use this command.");
            return;
        }
        if (args.length != 1) {
            sender.sendMessage("Usage: /rp-seturl <url>");
            return;
        }
        plugin.getConfig().set("allowed-url", args[0]);
        plugin.saveConfig();
        sender.sendMessage("Allowed URL set to: " + args[0]);
    }

    private void handleDebug(CommandSender sender) {
        if (!sender.hasPermission("resourcepackmanager.debug")) {
            sender.sendMessage("You don't have permission to use this command.");
            return;
        }
        boolean currentDebugState = plugin.isDebugEnabled();
        plugin.setDebugEnabled(!currentDebugState);
        sender.sendMessage("Debug mode " + (plugin.isDebugEnabled() ? "enabled" : "disabled") + ".");
    }
}
