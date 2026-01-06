package org.jortvanschijndel.resourcepackManager;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

public class ResourcePackInspector {

    private final Map<String, List<String>> models = new HashMap<>();

    public void inspect(File packFile) {
        models.clear();
        if (packFile == null || !packFile.exists()) return;

        try (ZipFile zip = new ZipFile(packFile)) {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                String name = entry.getName();
                // Structure: assets/<namespace>/models/<model>.json
                if (name.startsWith("assets/") && name.contains("/models/") && name.endsWith(".json")) {
                    String[] parts = name.split("/");
                    if (parts.length >= 4) {
                        String namespace = parts[1];
                        // parts[0] = assets
                        // parts[1] = namespace
                        // parts[2] = models
                        
                        int modelsIndex = name.indexOf("/models/");
                        if (modelsIndex != -1) {
                            String modelPath = name.substring(modelsIndex + "/models/".length());
                            modelPath = modelPath.replace(".json", "");
                            models.computeIfAbsent(namespace, k -> new ArrayList<>()).add(modelPath);
                        }
                    }
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public Set<String> getNamespaces() {
        return models.keySet();
    }

    public List<String> getModels(String namespace) {
        return models.getOrDefault(namespace, Collections.emptyList());
    }
}
