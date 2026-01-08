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

        // Open Category Menu
        Set<String> namespaces = plugin.getPackInspector().getNamespaces();
        List<String> sortedNamespaces = new ArrayList<>(namespaces);
        Collections.sort(sortedNamespaces);

        ModelViewerHolder holder = new ModelViewerHolder("categories", null, 0);
        Inventory inv = Bukkit.createInventory(holder, 54, Component.text("Model Categories"));
        holder.setInventory(inv);
        
        // Search Button
        inv.setItem(49, getSearchItem());

        // Animation
        animateItems(player, inv, sortedNamespaces, (namespace) -> {
            ItemStack item = new ItemStack(Material.CHEST);
            ItemMeta meta = item.getItemMeta();
            meta.displayName(Component.text(namespace, NamedTextColor.GOLD));
            meta.lore(List.of(Component.text("Click to view models", NamedTextColor.GRAY)));
            item.setItemMeta(meta);
            return item;
        });
    }

    private void openCategory(Player player, String namespace, int page) {
        List<String> models = plugin.getPackInspector().getModels(namespace);
        
        int pageSize = 45;
        int totalPages = (int) Math.ceil((double) models.size() / pageSize);
        if (page < 0) page = 0;
        if (page >= totalPages && totalPages > 0) page = totalPages - 1;

        ModelViewerHolder holder = new ModelViewerHolder("models", namespace, page);
        Inventory inv = Bukkit.createInventory(holder, 54, Component.text("Models: " + namespace));
        holder.setInventory(inv);

        // Navigation items
        if (page > 0) {
            ItemStack prev = new ItemStack(Material.ARROW);
            ItemMeta meta = prev.getItemMeta();
            meta.displayName(Component.text("Previous Page", NamedTextColor.YELLOW));
            prev.setItemMeta(meta);
            inv.setItem(45, prev);
        }
        
        ItemStack close = new ItemStack(Material.BARRIER);
        ItemMeta closeMeta = close.getItemMeta();
        closeMeta.displayName(Component.text("Back to Categories", NamedTextColor.RED));
        close.setItemMeta(closeMeta);
        inv.setItem(49, close);

        // Search Button
        inv.setItem(50, getSearchItem());

        if (page < totalPages - 1) {
            ItemStack next = new ItemStack(Material.ARROW);
            ItemMeta meta = next.getItemMeta();
            meta.displayName(Component.text("Next Page", NamedTextColor.YELLOW));
            next.setItemMeta(meta);
            inv.setItem(53, next);
        }

        // Items for current page
        int startIndex = page * pageSize;
        int endIndex = Math.min(startIndex + pageSize, models.size());
        List<String> pageModels = new ArrayList<>();
        if (startIndex < models.size()) {
            pageModels = models.subList(startIndex, endIndex);
        }

        FileConfiguration config = plugin.getConfig();
        String baseItemName = config.getString("model-viewer.base-item", "LEATHER_HORSE_ARMOR");
        Material baseMaterial = Material.matchMaterial(baseItemName);
        if (baseMaterial == null) baseMaterial = Material.LEATHER_HORSE_ARMOR;
        
        final Material finalBaseMaterial = baseMaterial;

        animateItems(player, inv, pageModels, (modelPath) -> {
            ItemStack item = new ItemStack(finalBaseMaterial);
            ItemMeta meta = item.getItemMeta();
            String shortName = modelPath.substring(modelPath.lastIndexOf('/') + 1);
            meta.displayName(Component.text(shortName, NamedTextColor.WHITE));
            try {
                // Use shortName for the key
                meta.setItemModel(new NamespacedKey(namespace, shortName));
            } catch (Exception e) {
                // Ignore invalid keys
            }
            item.setItemMeta(meta);
            return item;
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
                if (index >= items.size() || index >= 45) { // 45 is max content slots
                    this.cancel();
                    return;
                }
                
                // Calculate how many items to place this tick
                int totalItems = Math.min(items.size(), 45);
                double itemsPerTick = (double) totalItems / (double) finalTotalTicks;
                int itemsToPlace = (int) Math.ceil(itemsPerTick);
                if (itemsToPlace < 1) itemsToPlace = 1;

                for (int i = 0; i < itemsToPlace; i++) {
                    if (index >= items.size() || index >= 45) break;
                    
                    T data = items.get(index);
                    ItemStack item = mapper.map(data);
                    inv.setItem(index, item);
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

        if ("categories".equals(holder.type)) {
            // Search button
            if (event.getSlot() == 49 && clicked.getType() == Material.COMPASS) {
                startSearch(player);
                return;
            }

            // Clicked a category
            if (clicked.getType() == Material.CHEST) {
                Component displayName = clicked.getItemMeta().displayName();
                if (displayName instanceof TextComponent tc) {
                    openCategory(player, tc.content(), 0);
                }
            }
        } else if ("models".equals(holder.type)) {
            // Navigation
            if (event.getSlot() == 45 && clicked.getType() == Material.ARROW) {
                openCategory(player, holder.namespace, holder.page - 1);
                return;
            }
            if (event.getSlot() == 49 && clicked.getType() == Material.BARRIER) {
                open(player, null);
                return;
            }
            if (event.getSlot() == 50 && clicked.getType() == Material.COMPASS) {
                startSearch(player);
                return;
            }
            if (event.getSlot() == 53 && clicked.getType() == Material.ARROW) {
                openCategory(player, holder.namespace, holder.page + 1);
                return;
            }
            
            // Clicked a model
            if (event.getSlot() < 45) {
                // Give item
                player.getInventory().addItem(clicked.clone());
                player.sendMessage(Component.text("Given model!", NamedTextColor.GREEN));
            }
        } else if ("search_results".equals(holder.type)) {
             // Back button
            if (event.getSlot() == 49 && clicked.getType() == Material.BARRIER) {
                open(player, null);
                return;
            }
            // Search button
            if (event.getSlot() == 50 && clicked.getType() == Material.COMPASS) {
                startSearch(player);
                return;
            }
            
            // Clicked a model
            if (event.getSlot() < 45) {
                // Give item
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
        // Find all matching models across all namespaces
        Set<String> namespaces = plugin.getPackInspector().getNamespaces();
        
        // We need to store pairs of (namespace, modelPath)
        List<Map.Entry<String, String>> matchingModels = new ArrayList<>();

        for (String namespace : namespaces) {
            List<String> models = plugin.getPackInspector().getModels(namespace);
            for (String model : models) {
                if (model.toLowerCase().contains(query.toLowerCase())) {
                    matchingModels.add(new AbstractMap.SimpleEntry<>(namespace, model));
                }
            }
        }

        if (matchingModels.isEmpty()) {
            player.sendMessage(Component.text("No models found matching: " + query, NamedTextColor.RED));
            open(player, null);
            return;
        }

        ModelViewerHolder holder = new ModelViewerHolder("search_results", "search", 0);
        Inventory inv = Bukkit.createInventory(holder, 54, Component.text("Search: " + query));
        holder.setInventory(inv);
        
        ItemStack close = new ItemStack(Material.BARRIER);
        ItemMeta closeMeta = close.getItemMeta();
        closeMeta.displayName(Component.text("Back to Categories", NamedTextColor.RED));
        close.setItemMeta(closeMeta);
        inv.setItem(49, close);

        // Search Button
        inv.setItem(50, getSearchItem());

        FileConfiguration config = plugin.getConfig();
        String baseItemName = config.getString("model-viewer.base-item", "LEATHER_HORSE_ARMOR");
        Material baseMaterial = Material.matchMaterial(baseItemName);
        if (baseMaterial == null) baseMaterial = Material.LEATHER_HORSE_ARMOR;
        
        final Material finalBaseMaterial = baseMaterial;

        animateItems(player, inv, matchingModels, (entry) -> {
            String namespace = entry.getKey();
            String modelPath = entry.getValue();
            
            ItemStack item = new ItemStack(finalBaseMaterial);
            ItemMeta meta = item.getItemMeta();
            String shortName = modelPath.substring(modelPath.lastIndexOf('/') + 1);
            meta.displayName(Component.text(shortName, NamedTextColor.WHITE));
            meta.lore(List.of(Component.text(namespace, NamedTextColor.GRAY)));
            try {
                meta.setItemModel(new NamespacedKey(namespace, shortName));
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
        ItemStack searchItem = new ItemStack(Material.COMPASS);
        ItemMeta searchMeta = searchItem.getItemMeta();
        searchMeta.displayName(Component.text("Search Models", NamedTextColor.GREEN));
        searchMeta.lore(List.of(Component.text("Click to search for a model", NamedTextColor.GRAY)));
        searchItem.setItemMeta(searchMeta);
        return searchItem;
    }

    private interface ItemMapper<T> {
        ItemStack map(T data);
    }

    private static class ModelViewerHolder implements InventoryHolder {
        private final String type;
        private final String namespace;
        private final int page;
        private Inventory inventory;

        public ModelViewerHolder(String type, String namespace, int page) {
            this.type = type;
            this.namespace = namespace;
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
