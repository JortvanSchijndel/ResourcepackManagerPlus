package org.jortvanschijndel.resourcepackManager;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.scheduler.BukkitRunnable;
import org.jetbrains.annotations.NotNull;

import java.util.*;
import java.util.stream.Collectors;

public class ModelViewer implements Listener {

    private final ResourcepackManager plugin;
    private final Set<UUID> searchingPlayers = new HashSet<>();

    public ModelViewer(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    public void open(Player player, String search) {
        if (search != null && !search.isEmpty()) {
            openSearchResults(player, search);
            return;
        }
        openCategory(player, null, "", 0);
    }

    private void openCategory(Player player, String namespace, String path, int page) {
        if (namespace == null) {
            // Root: show namespaces
            Set<String> namespaces = plugin.getPackInspector().getNamespaces();
            List<String> sortedNamespaces = new ArrayList<>(namespaces);
            Collections.sort(sortedNamespaces);

            ModelViewerHolder holder = new ModelViewerHolder("namespaces", null, null, 0);
            Inventory inv = Bukkit.createInventory(holder, 54, Component.text("Model Categories"));
            holder.setInventory(inv);
            inv.setItem(49, getSearchItem());

            animateItems(player, inv, sortedNamespaces, (ns) -> {
                ItemStack item = new ItemStack(Material.CHEST);
                ItemMeta meta = item.getItemMeta();
                meta.displayName(Component.text(ns, NamedTextColor.GOLD));
                meta.lore(List.of(Component.text("Click to view models", NamedTextColor.GRAY)));
                item.setItemMeta(meta);
                return item;
            });
            return;
        }

        List<String> allModels = plugin.getPackInspector().getModels(namespace);
        final String currentPath = path.isEmpty() ? "" : path + "/";

        Set<String> subcategories = new HashSet<>();
        List<String> models = new ArrayList<>();
        Map<String, String> modelFullPathMap = new HashMap<>(); // Maps model name to its full path for NamespacedKey

        for (String modelIdentifier : allModels) {
            String modelPath = modelIdentifier.replace(":", "/");

            if (modelPath.startsWith(currentPath)) {
                String remainingPath = modelPath.substring(currentPath.length());
                String[] parts = remainingPath.split("/");

                if (parts.length > 1) {
                    if (parts.length == 2 && parts[0].equals(parts[1])) {
                        // Heuristic for "model/model" structure, treat as a model
                        if (!models.contains(parts[0])) {
                            models.add(parts[0]);
                            modelFullPathMap.put(parts[0], currentPath + remainingPath);
                        }
                    } else {
                        subcategories.add(parts[0]);
                    }
                } else if (!remainingPath.isEmpty()) {
                    models.add(remainingPath);
                    modelFullPathMap.put(remainingPath, currentPath + remainingPath);
                }
            }
        }

        List<String> sortedSubcategories = new ArrayList<>(subcategories);
        Collections.sort(sortedSubcategories);
        Collections.sort(models);

        List<Object> items = new ArrayList<>();
        items.addAll(sortedSubcategories);
        items.addAll(models);

        int pageSize = 45;
        int totalPages = (int) Math.ceil((double) items.size() / pageSize);
        if (page < 0) page = 0;
        if (page >= totalPages && totalPages > 0) page = totalPages - 1;

        String title = path.isEmpty() ? namespace : path.substring(path.lastIndexOf('/') + 1);
        ModelViewerHolder holder = new ModelViewerHolder("models", namespace, path, page);
        Inventory inv = Bukkit.createInventory(holder, 54, Component.text(title));
        holder.setInventory(inv);

        // Navigation
        if (page > 0) inv.setItem(45, createNavItem(Material.ARROW, "Previous Page"));
        inv.setItem(49, createNavItem(Material.BARRIER, "Back"));
        inv.setItem(50, getSearchItem());
        if (page < totalPages - 1) inv.setItem(53, createNavItem(Material.ARROW, "Next Page"));

        // Items for current page
        int startIndex = page * pageSize;
        int endIndex = Math.min(startIndex + pageSize, items.size());
        List<Object> pageItems = (startIndex < items.size()) ? items.subList(startIndex, endIndex) : Collections.emptyList();

        FileConfiguration config = plugin.getConfig();
        String baseItemName = config.getString("model-viewer.base-item", "LEATHER_HORSE_ARMOR");
        Material baseMaterial = Material.matchMaterial(baseItemName);
        if (baseMaterial == null) baseMaterial = Material.LEATHER_HORSE_ARMOR;
        final Material finalBaseMaterial = baseMaterial;

        animateItems(player, inv, pageItems, (item) -> {
            if (item instanceof String itemName) {
                if (subcategories.contains(itemName)) { // It's a subcategory
                    ItemStack stack = new ItemStack(Material.CHEST);
                    ItemMeta meta = stack.getItemMeta();
                    meta.displayName(Component.text(itemName, NamedTextColor.GOLD));
                    stack.setItemMeta(meta);
                    return stack;
                } else { // It's a model
                    ItemStack stack = new ItemStack(finalBaseMaterial);
                    ItemMeta meta = stack.getItemMeta();
                    meta.displayName(Component.text(itemName, NamedTextColor.WHITE));
                    try {
                        String fullModelPath = modelFullPathMap.get(itemName);
                        if (fullModelPath != null) {
                            meta.setItemModel(new NamespacedKey(namespace, fullModelPath));
                        }
                    } catch (Exception e) {
                        // Ignore invalid keys
                    }
                    stack.setItemMeta(meta);
                    return stack;
                }
            }
            return null;
        });
    }

    private <T> void animateItems(Player player, Inventory inv, List<T> items, ItemMapper<T> mapper) {
        player.openInventory(inv);
        
        FileConfiguration config = plugin.getConfig();
        boolean animationEnabled = config.getBoolean("model-viewer.animation-enabled", true);
        
        if (!animationEnabled) {
            for (int i = 0; i < items.size() && i < 45; i++) {
                inv.setItem(i, mapper.map(items.get(i)));
            }
            return;
        }

        double duration = config.getDouble("model-viewer.animation-duration", 2.5);
        long totalTicks = (long) (duration * 20);
        if (totalTicks < 1) totalTicks = 1;

        final long finalTotalTicks = totalTicks;

        new BukkitRunnable() {
            int index = 0;
            
            @Override
            public void run() {
                if (index >= items.size() || index >= 45) {
                    this.cancel();
                    return;
                }
                
                int totalItems = Math.min(items.size(), 45);
                double itemsPerTick = (double) totalItems / (double) finalTotalTicks;
                int itemsToPlace = (int) Math.ceil(itemsPerTick);
                if (itemsToPlace < 1) itemsToPlace = 1;

                for (int i = 0; i < itemsToPlace; i++) {
                    if (index >= items.size() || index >= 45) break;
                    
                    T data = items.get(index);
                    ItemStack item = mapper.map(data);
                    if (item != null) {
                        inv.setItem(index, item);
                    }
                    index++;
                }
            }
        }.runTaskTimer(plugin, 0L, 1L);
    }

    @EventHandler
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof ModelViewerHolder holder)) return;
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player)) return;
        ItemStack clicked = event.getCurrentItem();
        if (clicked == null || clicked.getType() == Material.AIR) return;

        String type = holder.type;

        if ("namespaces".equals(type)) {
            if (event.getSlot() == 49) {
                startSearch(player);
                return;
            }
            if (clicked.getType() == Material.CHEST) {
                Component displayName = clicked.getItemMeta().displayName();
                if (displayName instanceof TextComponent tc) {
                    openCategory(player, tc.content(), "", 0);
                }
            }
        } else if ("models".equals(type)) {
            // Navigation
            if (event.getSlot() == 45) { // Prev
                openCategory(player, holder.namespace, holder.path, holder.page - 1);
                return;
            }
            if (event.getSlot() == 49) { // Back
                if (holder.path == null || holder.path.isEmpty()) {
                    open(player, null); // Back to namespaces
                } else {
                    String parentPath = holder.path.contains("/") ? holder.path.substring(0, holder.path.lastIndexOf('/')) : "";
                    openCategory(player, holder.namespace, parentPath, 0);
                }
                return;
            }
            if (event.getSlot() == 50) { // Search
                startSearch(player);
                return;
            }
            if (event.getSlot() == 53) { // Next
                openCategory(player, holder.namespace, holder.path, holder.page + 1);
                return;
            }

            // Clicked an item
            if (event.getSlot() < 45) {
                if (clicked.getType() == Material.CHEST) { // It's a subcategory
                    Component displayName = clicked.getItemMeta().displayName();
                    if (displayName instanceof TextComponent tc) {
                        String newPath = holder.path.isEmpty() ? tc.content() : holder.path + "/" + tc.content();
                        openCategory(player, holder.namespace, newPath, 0);
                    }
                } else { // It's a model
                    player.getInventory().addItem(clicked.clone());
                    player.sendMessage(Component.text("Given model!", NamedTextColor.GREEN));
                }
            }
        } else if ("search_results".equals(type)) {
            if (event.getSlot() == 49) {
                open(player, null);
                return;
            }
            if (event.getSlot() == 50) {
                startSearch(player);
                return;
            }
            if (event.getSlot() < 45) {
                player.getInventory().addItem(clicked.clone());
                player.sendMessage(Component.text("Given model!", NamedTextColor.GREEN));
            }
        }
    }

    @EventHandler
    public void onChat(AsyncPlayerChatEvent event) {
        if (searchingPlayers.contains(event.getPlayer().getUniqueId())) {
            event.setCancelled(true);
            searchingPlayers.remove(event.getPlayer().getUniqueId());
            String query = event.getMessage();
            Bukkit.getScheduler().runTask(plugin, () -> openSearchResults(event.getPlayer(), query));
        }
    }

    private void openSearchResults(Player player, String query) {
        List<Map.Entry<String, String>> matchingModels = new ArrayList<>();
        for (String namespace : plugin.getPackInspector().getNamespaces()) {
            for (String modelIdentifier : plugin.getPackInspector().getModels(namespace)) {
                if (modelIdentifier.toLowerCase().contains(query.toLowerCase())) {
                    matchingModels.add(new AbstractMap.SimpleEntry<>(namespace, modelIdentifier));
                }
            }
        }

        if (matchingModels.isEmpty()) {
            player.sendMessage(Component.text("No models found matching: " + query, NamedTextColor.RED));
            open(player, null);
            return;
        }

        ModelViewerHolder holder = new ModelViewerHolder("search_results", "search", null, 0);
        Inventory inv = Bukkit.createInventory(holder, 54, Component.text("Search: " + query));
        holder.setInventory(inv);
        
        inv.setItem(49, createNavItem(Material.BARRIER, "Back to Categories"));
        inv.setItem(50, getSearchItem());

        FileConfiguration config = plugin.getConfig();
        String baseItemName = config.getString("model-viewer.base-item", "LEATHER_HORSE_ARMOR");
        Material baseMaterial = Material.matchMaterial(baseItemName);
        if (baseMaterial == null) baseMaterial = Material.LEATHER_HORSE_ARMOR;
        final Material finalBaseMaterial = baseMaterial;

        animateItems(player, inv, matchingModels, (entry) -> {
            String namespace = entry.getKey();
            String modelIdentifier = entry.getValue();
            String modelPath = modelIdentifier.replace(":", "/");
            
            ItemStack item = new ItemStack(finalBaseMaterial);
            ItemMeta meta = item.getItemMeta();
            String shortName = modelPath.substring(modelPath.lastIndexOf('/') + 1);
            meta.displayName(Component.text(shortName, NamedTextColor.WHITE));
            meta.lore(List.of(Component.text(namespace + ":" + modelIdentifier, NamedTextColor.GRAY)));
            try {
                meta.setItemModel(new NamespacedKey(namespace, modelPath));
            } catch (Exception e) {
                // Ignore
            }
            item.setItemMeta(meta);
            return item;
        });
    }

    private void startSearch(Player player) {
        player.closeInventory();
        searchingPlayers.add(player.getUniqueId());
        player.sendMessage(Component.text("Please type your search query in chat.", NamedTextColor.GREEN));
    }

    private ItemStack getSearchItem() {
        return createNavItem(Material.COMPASS, "Search Models", "Click to search for a model");
    }

    private ItemStack createNavItem(Material material, String name, String... lore) {
        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.displayName(Component.text(name, NamedTextColor.GREEN));
        if (lore.length > 0) {
            meta.lore(Arrays.stream(lore).map(l -> Component.text(l, NamedTextColor.GRAY)).collect(Collectors.toList()));
        }
        item.setItemMeta(meta);
        return item;
    }

    private interface ItemMapper<T> {
        ItemStack map(T data);
    }

    private static class ModelViewerHolder implements InventoryHolder {
        private final String type;
        private final String namespace;
        private final String path;
        private final int page;
        private Inventory inventory;

        public ModelViewerHolder(String type, String namespace, String path, int page) {
            this.type = type;
            this.namespace = namespace;
            this.path = path;
            this.page = page;
        }

        public void setInventory(Inventory inventory) {
            this.inventory = inventory;
        }

        @Override
        public @NotNull Inventory getInventory() {
            return inventory;
        }
    }
}
