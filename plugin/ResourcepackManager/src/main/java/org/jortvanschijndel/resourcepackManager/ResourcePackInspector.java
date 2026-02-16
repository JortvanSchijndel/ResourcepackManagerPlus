package org.jortvanschijndel.resourcepackManager;

import java.io.File;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.*;

public class ResourcePackInspector {

    public static class ModelInfo {
        public final String realNamespace;
        public final String realPath;
        public final String displayNamespace;
        public final String displayPath;

        public ModelInfo(String realNamespace, String realPath, String displayNamespace, String displayPath) {
            this.realNamespace = realNamespace;
            this.realPath = realPath;
            this.displayNamespace = displayNamespace;
            this.displayPath = displayPath;
        }
    }

    private final ResourcepackManager plugin;
    // displayNamespace -> (displayPath -> ModelInfo)
    private final Map<String, Map<String, ModelInfo>> models = new HashMap<>();

    public ResourcePackInspector(ResourcepackManager plugin) {
        this.plugin = plugin;
    }

    public void inspect(File packFile) {
        models.clear();
        if (packFile == null || !packFile.exists()) {
            if (plugin.isDebugEnabled()) {
                plugin.getLogger().info("[Debug] No pack file to inspect or file does not exist.");
            }
            return;
        }

        if (plugin.isDebugEnabled()) {
            plugin.getLogger().info("[Debug] Starting resource pack inspection of: " + packFile.getName());
        }

        try (ZipFile zip = new ZipFile(packFile)) {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                String name = entry.getName().replace("\\", "/"); // Normalize slashes

                if (name.startsWith("assets/") && name.contains("/models/item/") && name.endsWith(".json")) {
                    String[] parts = name.split("/");
                    if (parts.length < 5) continue;

                    String realNamespace = parts[1];
                    String realPath = name.substring(name.indexOf("/models/item/") + "/models/item/".length(), name.length() - 5);

                    // Handle .../name/name.json convention by flattening the path
                    String[] pathParts = realPath.split("/");
                    if (pathParts.length > 1 && pathParts[pathParts.length - 1].equals(pathParts[pathParts.length - 2])) {
                        String originalPath = realPath;
                        realPath = String.join("/", Arrays.copyOf(pathParts, pathParts.length - 1));
                    }

                    String displayNamespace = realNamespace;
                    String displayPath = realPath;

                    if (realNamespace.contains("-")) {
                        String[] nsParts = realNamespace.split("-", 2);
                        displayNamespace = nsParts[0];
                        displayPath = nsParts[1] + "/" + realPath;
                    }

                    ModelInfo modelInfo = new ModelInfo(realNamespace, realPath, displayNamespace, displayPath);
                    models.computeIfAbsent(displayNamespace, k -> new HashMap<>()).put(displayPath, modelInfo);
                }
            }
        } catch (IOException e) {
            plugin.getLogger().severe("Failed to inspect resource pack: " + e.getMessage());
            e.printStackTrace();
        }
        if (plugin.isDebugEnabled()) {
            plugin.getLogger().info("[Debug] Inspection finished. Found " + models.size() + " display namespaces.");
        }
    }

    public Set<String> getNamespaces() {
        return models.keySet();
    }

    public List<String> getModels(String namespace) {
        if (!models.containsKey(namespace)) return Collections.emptyList();
        return new ArrayList<>(models.get(namespace).keySet());
    }

    public ModelInfo getModelInfo(String displayNamespace, String displayPath) {

        if (!models.containsKey(displayNamespace)) {
            if (plugin.isDebugEnabled()) plugin.getLogger().info("[Debug] Display namespace not found.");
            return null;
        }

        Map<String, ModelInfo> namespaceModels = models.get(displayNamespace);

        ModelInfo exactMatch = namespaceModels.get(displayPath);
        if (exactMatch != null) {
            return exactMatch;
        }

        for (Map.Entry<String, ModelInfo> entry : namespaceModels.entrySet()) {
            String path = entry.getKey();
            if (path.endsWith("/" + displayPath) || path.equals(displayPath)) {
                return entry.getValue();
            }
        }

        return null;
    }

    public List<String> getModelsInPath(String namespace, String pathPrefix) {
        if (!models.containsKey(namespace)) return Collections.emptyList();


        Set<String> files = new HashSet<>();
        Set<String> folders = new HashSet<>();
        Set<String> namespaceModelPaths = models.get(namespace).keySet();

        for (String fullPath : namespaceModelPaths) {
            if (!fullPath.startsWith(pathPrefix)) continue;

            String relativePath = fullPath.substring(pathPrefix.length());
            if (relativePath.startsWith("/")) relativePath = relativePath.substring(1);

            int slashIndex = relativePath.indexOf('/');
            if (slashIndex != -1) {
                String folderName = relativePath.substring(0, slashIndex);
                folders.add(folderName);
            } else {
                if (!relativePath.isEmpty()) {
                    files.add(relativePath);
                }
            }
        }

        List<String> result = new ArrayList<>();
        // Add folders first, then files, and sort them for consistent order
        List<String> sortedFolders = new ArrayList<>(folders);
        Collections.sort(sortedFolders);
        for (String folder : sortedFolders) {
            // Per user request, if a name is a file, it should not be shown as a folder.
            if (!files.contains(folder)) {
                result.add(folder + "/");
            }
        }

        List<String> sortedFiles = new ArrayList<>(files);
        Collections.sort(sortedFiles);
        result.addAll(sortedFiles);

        return result;
    }
}
