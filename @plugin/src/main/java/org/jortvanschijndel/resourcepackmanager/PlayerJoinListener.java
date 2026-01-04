package org.jortvanschijndel.resourcepackmanager;

import net.kyori.adventure.resource.ResourcePackInfo;
import net.kyori.adventure.resource.ResourcePackRequest;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

import java.io.File;
import java.io.FileInputStream;
import java.net.URI;
import java.security.MessageDigest;

public class PlayerJoinListener implements Listener {

    private final ResourcepackManager plugin;

    public PlayerJoinListener(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();

        // Delay by one tick to ensure the player is fully initialized
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            String serverIp = plugin.getConfig().getString("server-ip");
            int port = plugin.getConfig().getInt("port", 8080);

            if (serverIp == null || serverIp.isEmpty()) {
                plugin.getLogger().warning("server-ip is not set in config.yml. Cannot send resource pack.");
                return;
            }

            String packUrl = String.format("http://%s:%d/pack.zip", serverIp, port);

            File packFile = new File(plugin.getResourcePackDir(), "pack.zip");
            if (!packFile.exists()) {
                 plugin.getLogger().warning("Active resource pack (pack.zip) not found.");
                 return;
            }

            try {
                String sha1 = calculateSHA1(packFile);
                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().info("[Debug] Sending resource pack to " + player.getName() + " with URL: " + packUrl);
                }

                final ResourcePackInfo packInfo = ResourcePackInfo.resourcePackInfo()
                        .uri(URI.create(packUrl))
                        .hash(sha1)
                        .build();

                final ResourcePackRequest request = ResourcePackRequest.resourcePackRequest()
                        .packs(packInfo)
                        .prompt(Component.text("Please download the resource pack!"))
                        .required(true)
                        .build();

                player.sendResourcePacks(request);

            } catch (Exception e) {
                plugin.getLogger().severe("Failed to process resource pack: " + e.getMessage());
                e.printStackTrace();
            }
        }, 1L);
    }

    private String calculateSHA1(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] byteArray = new byte[1024];
            int bytesCount;
            while ((bytesCount = fis.read(byteArray)) != -1) {
                digest.update(byteArray, 0, bytesCount);
            }
        }
        byte[] bytes = digest.digest();
        StringBuilder sb = new StringBuilder();
        for (byte aByte : bytes) {
            sb.append(Integer.toString((aByte & 0xff) + 0x100, 16).substring(1));
        }
        return sb.toString();
    }
}
