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
                // Structure: assets/<namespace>/models/item/<category>/<subcategory>/<model>.json
                if (name.startsWith("assets/") && name.contains("/models/item/") && name.endsWith(".json")) {
                    String[] parts = name.split("/");
                    if (parts.length >= 5) { // assets, namespace, models, item, category..., model.json
                        String namespace = parts[1];

                        int modelsItemIndex = name.indexOf("/models/item/");
                        if (modelsItemIndex != -1) {
                            String modelPath = name.substring(modelsItemIndex + "/models/item/".length());
                            if (modelPath.endsWith(".json")) {
                                modelPath = modelPath.substring(0, modelPath.length() - 5);
                            }

                            // The model identifier is now the full path within the item folder
                            // Format: category/subcategory:modelname
                            int lastSlash = modelPath.lastIndexOf('/');
                            if (lastSlash != -1) {
                                modelPath = modelPath.substring(0, lastSlash) + ":" + modelPath.substring(lastSlash + 1);
                            }

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
