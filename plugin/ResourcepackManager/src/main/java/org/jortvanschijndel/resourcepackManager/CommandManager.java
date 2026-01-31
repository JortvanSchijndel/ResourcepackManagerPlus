package org.jortvanschijndel.resourcepackManager;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.io.File;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class CommandManager implements CommandExecutor, TabCompleter {

    private final ResourcepackManager plugin;
    private final MiniMessage miniMessage = MiniMessage.miniMessage();
    private final ModelViewer modelViewer;

    public CommandManager(ResourcepackManager plugin) {
        this.plugin = plugin;
        this.modelViewer = new ModelViewer(plugin);
        plugin.getServer().getPluginManager().registerEvents(modelViewer, plugin);
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, String @NotNull [] args) {
        if (command.getName().equalsIgnoreCase("give-model")) {
            handleGiveModel(sender, args);
            return true;
        }

        if (command.getName().equalsIgnoreCase("models")) {
            handleModelViewer(sender, args);
            return true;
        }

        if (command.getName().equalsIgnoreCase("rmp")) {
            if (args.length == 0) {
                Component parsed = miniMessage.deserialize(
                        "<gradient:#5e4fa2:#f79459>ResourcepackManagerPlus</gradient> <gray>v" + plugin.getPluginMeta().getVersion() + "</gray><br>" +
                                "<dark_gray>»</dark_gray> <gold>/rmp reload</gold> <dark_gray>-</dark_gray> <gray>Reloads the configuration.</gray><br>" +
                                "<dark_gray>»</dark_gray> <gold>/rmp status</gold> <dark_gray>-</dark_gray> <gray>Shows the current status.</gray><br>" +
                                "<dark_gray>»</dark_gray> <gold>/rmp seturl <url></gold> <dark_gray>-</dark_gray> <gray>Sets the allowed URL for resource packs.</gray><br>" +
                                "<dark_gray>»</dark_gray> <gold>/rmp debug</gold> <dark_gray>-</dark_gray> <gray>Toggles debug mode.</gray><br>" +
                                "<dark_gray>»</dark_gray> <gold>/rmp give-model <item> <namespace> <model_identifier></gold> <dark_gray>-</dark_gray> <gray>Gives a custom model.</gray><br>" +
                                "<dark_gray>»</dark_gray> <gold>/rmp model-viewer [search]</gold> <dark_gray>-</dark_gray> <gray>Opens the model viewer GUI.</gray>"
                );
                sender.sendMessage(parsed);
                return true;
            }

            String subCommand = args[0].toLowerCase();
            String[] subArgs = Arrays.copyOfRange(args, 1, args.length);

            switch (subCommand) {
                case "reload" -> handleReload(sender);
                case "status" -> handleStatus(sender);
                case "seturl" -> handleSetUrl(sender, subArgs);
                case "debug" -> handleDebug(sender);
                case "give-model" -> handleGiveModel(sender, subArgs);
                case "model-viewer" -> handleModelViewer(sender, subArgs);
                default -> sender.sendMessage("Unknown subcommand. Usage: /rmp <reload|status|seturl|debug|give-model|model-viewer>");
            }
            return true;
        }
        return false;
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command, @NotNull String alias, String @NotNull [] args) {
        if (command.getName().equalsIgnoreCase("give-model")) {
            return handleGiveModelTabComplete(args);
        }

        if (command.getName().equalsIgnoreCase("rmp")) {
            if (args.length == 1) {
                List<String> subCommands = Arrays.asList("reload", "status", "seturl", "debug", "give-model", "model-viewer");
                return subCommands.stream()
                        .filter(s -> s.startsWith(args[0].toLowerCase()))
                        .toList();
            } else if (args.length > 1) {
                if (args[0].equalsIgnoreCase("give-model")) {
                    return handleGiveModelTabComplete(Arrays.copyOfRange(args, 1, args.length));
                }
            }
        }
        return Collections.emptyList();
    }

    private void handleGiveModel(CommandSender sender, String[] args) {
        if (!sender.hasPermission("resourcepackmanager.give-model")) {
            sender.sendMessage(miniMessage.deserialize("<red>You don't have permission to use this command.</red>"));
            return;
        }

        if (!(sender instanceof Player player)) {
            sender.sendMessage(miniMessage.deserialize("<red>This command can only be used by players.</red>"));
            return;
        }

        if (args.length < 3) {
            sender.sendMessage(miniMessage.deserialize("<red>Usage: /give-model <item> <namespace> <model_identifier></red>"));
            return;
        }

        String itemName = args[0];
        String displayNamespace = args[1];
        String modelIdentifier = String.join(" ", Arrays.copyOfRange(args, 2, args.length));

        ResourcePackInspector.ModelInfo modelInfo = plugin.getPackInspector().getModelInfo(displayNamespace, modelIdentifier);

        if (modelInfo == null) {
            sender.sendMessage(miniMessage.deserialize("<red>Model not found: " + modelIdentifier + "</red>"));
            return;
        }

        Material material = Material.matchMaterial(itemName);
        if (material == null) {
            sender.sendMessage(miniMessage.deserialize("<red>Invalid material: " + itemName + "</red>"));
            return;
        }

        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        if (meta != null) {
            try {
                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().info("[Debug] Applying model to given item: " + modelInfo.realNamespace + ":" + modelInfo.realPath);
                }
                meta.setItemModel(new NamespacedKey(modelInfo.realNamespace, modelInfo.realPath));
                item.setItemMeta(meta);
            } catch (IllegalArgumentException e) {
                sender.sendMessage(miniMessage.deserialize("<red>Invalid namespace or key: " + modelInfo.realNamespace + ":" + modelInfo.realPath + "</red>"));
                return;
            }
        }

        Map<Integer, ItemStack> leftovers = player.getInventory().addItem(item);
        for (ItemStack leftover : leftovers.values()) {
            player.getWorld().dropItem(player.getLocation(), leftover);
        }

        sender.sendMessage(miniMessage.deserialize("<green>Given model successfully.</green>"));
    }

    private List<String> handleGiveModelTabComplete(String[] args) {
        if (args.length == 1) {
            return Arrays.stream(Material.values())
                    .filter(Material::isItem)
                    .map(Material::name)
                    .map(String::toLowerCase)
                    .filter(name -> name.startsWith(args[0].toLowerCase()))
                    .toList();
        } else if (args.length == 2) {
            return plugin.getPackInspector().getNamespaces().stream()
                    .filter(s -> s.startsWith(args[1].toLowerCase()))
                    .toList();
        } else if (args.length >= 3) {
            String namespace = args[1];
            String currentInput = String.join(" ", Arrays.copyOfRange(args, 2, args.length)).toLowerCase();

            return plugin.getPackInspector().getModels(namespace).stream()
                    .filter(s -> s.toLowerCase().startsWith(currentInput))
                    .collect(Collectors.toList());
        }
        return Collections.emptyList();
    }

    private void handleModelViewer(CommandSender sender, String[] args) {
        if (!sender.hasPermission("resourcepackmanager.model-viewer")) {
            sender.sendMessage(miniMessage.deserialize("<red>You don't have permission to use this command.</red>"));
            return;
        }
        if (!(sender instanceof Player player)) {
            sender.sendMessage(miniMessage.deserialize("<red>This command can only be used by players.</red>"));
            return;
        }

        String search = args.length > 0 ? String.join(" ", args) : null;
        modelViewer.open(player, search);
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
            sender.sendMessage("Usage: /rmp seturl <url>");
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
        if (plugin.isDebugEnabled()) {
            sender.sendMessage("Reloading plugin to apply debug changes and re-inspect pack...");
            plugin.reloadPluginConfig();
        }
    }
}
