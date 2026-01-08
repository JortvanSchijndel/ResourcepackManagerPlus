package org.jortvanschijndel.resourcepackManager;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.resource.ResourcePackInfo;
import net.kyori.adventure.resource.ResourcePackRequest;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class PlayerJoinListener implements Listener {

    private final ResourcepackManager plugin;

    public PlayerJoinListener(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onPlayerLogin(PlayerJoinEvent event) {
        if (plugin.isDebugEnabled()) {
            plugin.getLogger().info("Player " + event.getPlayer().getName() + " is logging in, attempting to apply resource pack...");
        }
        Player player = event.getPlayer();
        File activePack = plugin.getActivePack();

        if (activePack != null) {
            if (plugin.isDebugEnabled()) {
                plugin.getLogger().info("Active pack is: " + activePack.getName());
            }
            String serverIp = plugin.getConfig().getString("server-ip");
            int port = plugin.getConfig().getInt("port");
            
            String token = plugin.generateToken(player.getUniqueId());
            String url = "http://" + serverIp + ":" + port + "/pack.zip?token=" + token;

            try {
                String hash = calculateSHA1(activePack);
                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().info("Calculated SHA-1 hash: " + hash);
                    plugin.getLogger().info("Sending resource pack request to " + player.getName() + " with URL: " + url);
                }

                final ResourcePackInfo packInfo = ResourcePackInfo.resourcePackInfo()
                    .uri(URI.create(url))
                    .hash(hash)
                    .build();

                final ResourcePackRequest request = ResourcePackRequest.resourcePackRequest()
                    .packs(packInfo)
                    .prompt(Component.text("Please download the server's resource pack."))
                    .required(true)
                    .build();

                player.sendResourcePacks(request);
                if (plugin.isDebugEnabled()) {
                    plugin.getLogger().info("Resource pack request sent to " + player.getName());
                }

            } catch (IOException | NoSuchAlgorithmException e) {
                plugin.getLogger().severe("Could not calculate resource pack hash: " + e.getMessage());
                plugin.getLogger().severe("Error sending resource pack to " + player.getName());
            }
        } else {
            if (plugin.isDebugEnabled()) {
                plugin.getLogger().info("No active resource pack found.");
            }
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
