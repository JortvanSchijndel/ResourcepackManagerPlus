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
                // Structure: assets/<namespace>/models/item/<model>.json
                // Or legacy: assets/<namespace>/models/item/<category>/<subcategory>/<model>.json

                if (name.startsWith("assets/") && name.contains("/models/item/") && name.endsWith(".json")) {
                    String[] parts = name.split("/");
                    // parts[0] = assets
                    // parts[1] = namespace
                    // parts[2] = models
                    // parts[3] = item
                    // parts[4+] = model path

                    if (parts.length >= 5) {
                        String namespace = parts[1];

                        int modelsItemIndex = name.indexOf("/models/item/");
                        if (modelsItemIndex != -1) {
                            String modelPath = name.substring(modelsItemIndex + "/models/item/".length());
                            if (modelPath.endsWith(".json")) {
                                modelPath = modelPath.substring(0, modelPath.length() - 5);
                            }

                            // The model identifier is the path within the item folder
                            // If it's flattened (new structure), it's just "modelname"
                            // If it's legacy, it's "category/subcategory/modelname"

                            // We store it as is, because NamespacedKey expects "namespace:path/to/model"
                            // But for tab completion we might want to show it nicely.
                            // The previous implementation replaced last slash with colon, which is weird for NamespacedKey
                            // NamespacedKey is (namespace, key). Key can contain slashes.

                            // Let's just store the raw path relative to item folder.
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
