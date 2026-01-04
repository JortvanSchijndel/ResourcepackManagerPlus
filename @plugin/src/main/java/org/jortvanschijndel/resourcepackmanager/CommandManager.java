package org.jortvanschijndel.resourcepackmanager;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;

import java.io.File;

public class CommandManager implements CommandExecutor {

    private final ResourcepackManager plugin;

    public CommandManager(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("resourcepackmanager.admin")) {
            sender.sendMessage("§cYou do not have permission to use this command.");
            return true;
        }

        switch (command.getName().toLowerCase()) {
            case "rp-reload":
                plugin.reloadConfig();
                sender.sendMessage("§aResourcepackManager configuration reloaded.");
                return true;

            case "rp-status":
                File activePack = new File(plugin.getResourcePackDir(), "pack.zip");
                sender.sendMessage("§a--- ResourcepackManager Status ---");
                sender.sendMessage("§eActive Pack: §f" + (activePack.exists() ? "pack.zip" : "None"));
                sender.sendMessage("§eActive Pack SHA-1: §f" + plugin.getConfig().getString("active-pack-sha1", "N/A"));
                File[] history = plugin.getResourcePackDir().listFiles((dir, name) -> name.startsWith("pack-"));
                sender.sendMessage("§eHistorical Packs: §f" + (history != null ? history.length : 0));
                sender.sendMessage("§eDebug Mode: §f" + (plugin.isDebugEnabled() ? "§aEnabled" : "§cDisabled"));
                return true;

            case "rp-seturl":
                if (args.length == 0) {
                    sender.sendMessage("§cUsage: /rp-seturl <url>");
                    return false;
                }
                String url = args[0];
                plugin.getConfig().set("allowed-url", url);
                plugin.saveConfig();
                sender.sendMessage("§aAllowed URL set to: " + url);
                return true;

            case "rp-debug":
                plugin.setDebugEnabled(!plugin.isDebugEnabled());
                sender.sendMessage("§aWeb server debug logging is now " + (plugin.isDebugEnabled() ? "§aenabled" : "§cdisabled") + ".");
                return true;
        }
        return false;
    }
}