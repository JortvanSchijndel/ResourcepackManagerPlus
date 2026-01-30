import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { API_URL } from '../../config/constants';

export const MinecraftModel = ({ modelData, bbModelData, branch, namespace, modelIdentifier }) => {
  const [textureMap, setTextureMap] = useState({});

  useEffect(() => {
    const loadTextures = async () => {
      const loader = new THREE.TextureLoader();
      const newTextureMap = {};
      
      // Helper to extract filename from path (e.g. "namespace:item/folder/file" -> "file")
      const getFilename = (path) => {
          if (!path) return '';
          const cleanPath = path.includes(':') ? path.split(':')[1] : path;
          const parts = cleanPath.split('/');
          return parts[parts.length - 1];
      };

      // 1. Load textures from BBModel (embedded) if available
      const bbTextures = {};
      if (bbModelData?.textures) {
        for (const tex of bbModelData.textures) {
          if (tex.source && tex.source.startsWith('data:image')) {
            try {
              const texture = await loader.loadAsync(tex.source);
              texture.magFilter = THREE.NearestFilter;
              texture.minFilter = THREE.NearestFilter;
              texture.colorSpace = THREE.SRGBColorSpace;
              
              // Key by filename without extension
              const name = tex.name.replace(/\.png$/i, '');
              bbTextures[name] = texture;
            } catch (e) {
              console.warn(`Failed to load embedded texture ${tex.name}:`, e);
            }
          }
        }
      }

      // 2. Map model.json texture keys to actual textures
      if (modelData?.textures) {
        for (const [key, texturePath] of Object.entries(modelData.textures)) {
            const filename = getFilename(texturePath);
            
            // Try to find in BBModel textures first (Upload Preview)
            if (bbTextures[filename]) {
                newTextureMap[key] = bbTextures[filename];
                newTextureMap[`#${key}`] = bbTextures[filename];
            } 
            // Fallback to API if branch info is available (Model Card / Detail)
            else if (branch && namespace && modelIdentifier) {
                const url = `${API_URL}/texture/${branch}/${namespace}/${modelIdentifier}/${filename}.png`;
                try {
                    const texture = await loader.loadAsync(url);
                    texture.magFilter = THREE.NearestFilter;
                    texture.minFilter = THREE.NearestFilter;
                    texture.colorSpace = THREE.SRGBColorSpace;
                    newTextureMap[key] = texture;
                    newTextureMap[`#${key}`] = texture;
                } catch (e) {
                    console.warn(`Failed to load texture ${key} from API:`, e);
                }
            }
        }
      }
      
      setTextureMap(newTextureMap);
    };

    loadTextures();
  }, [modelData, bbModelData, branch, namespace, modelIdentifier]);

  const group = useMemo(() => {
    const group = new THREE.Group();

    if (modelData?.elements) {
      modelData.elements.forEach((element) => {
        const from = element.from || [0, 0, 0];
        const to = element.to || [16, 16, 16];
        
        const size = [
          (to[0] - from[0]) / 16,
          (to[1] - from[1]) / 16,
          (to[2] - from[2]) / 16,
        ];
        
        const position = [
          (from[0] + to[0]) / 2 / 16 - 0.5,
          (from[1] + to[1]) / 2 / 16 - 0.5,
          (from[2] + to[2]) / 2 / 16 - 0.5,
        ];

        const materials = [];
        const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];
        
        // Create geometry
        let geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        geometry = geometry.toNonIndexed();
        const uvAttribute = geometry.attributes.uv;

        faceOrder.forEach((faceName, i) => {
          const face = element.faces?.[faceName];
          
          if (face) {
              // Texture
              let texture = null;
              if (face.texture) {
                  let texKey = face.texture.startsWith('#') ? face.texture.substring(1) : face.texture;
                  texture = textureMap[texKey];
              }

              const material = new THREE.MeshStandardMaterial({ 
                  color: texture ? '#ffffff' : '#3b82f6',
                  map: texture || null,
                  transparent: true,
                  alphaTest: 0.1
              });
              materials.push(material);

              // UV Mapping
              if (face.uv) {
                  let [u1, v1, u2, v2] = face.uv;
                  
                  // Normalize to 0-1
                  u1 /= 16;
                  v1 /= 16;
                  u2 /= 16;
                  v2 /= 16;
                  
                  // Invert V
                  v1 = 1 - v1;
                  v2 = 1 - v2;
                  
                  const offset = i * 6;
                  
                  // Map UVs to vertices
                  // 0: Top-Left, 1: Bottom-Left, 2: Top-Right
                  // 3: Bottom-Left, 4: Bottom-Right, 5: Top-Right
                  
                  uvAttribute.setXY(offset, u1, v1);
                  uvAttribute.setXY(offset + 1, u1, v2);
                  uvAttribute.setXY(offset + 2, u2, v1);
                  
                  uvAttribute.setXY(offset + 3, u1, v2);
                  uvAttribute.setXY(offset + 4, u2, v2);
                  uvAttribute.setXY(offset + 5, u2, v1);
              }
          } else {
              // Invisible material for missing faces
              materials.push(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, visible: false }));
          }
        });
        
        geometry.attributes.uv.needsUpdate = true;

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.position.set(position[0], position[1], position[2]);
        
        // Rotation
        if (element.rotation) {
          const { origin, axis, angle } = element.rotation;
          const originX = origin[0] / 16 - 0.5;
          const originY = origin[1] / 16 - 0.5;
          const originZ = origin[2] / 16 - 0.5;

          const pivot = new THREE.Group();
          pivot.position.set(originX, originY, originZ);
          
          mesh.position.sub(pivot.position);
          pivot.add(mesh);
          
          if (axis === 'x') pivot.rotation.x = (angle * Math.PI) / 180;
          if (axis === 'y') pivot.rotation.y = (angle * Math.PI) / 180;
          if (axis === 'z') pivot.rotation.z = (angle * Math.PI) / 180;
          
          group.add(pivot);
        } else {
          group.add(mesh);
        }
      });
    } else if (modelData?.textures) {
        // Fallback for item models (no elements)
        const texture = textureMap['layer0'] || Object.values(textureMap)[0];
        if (texture) {
            const geometry = new THREE.PlaneGeometry(1, 1);
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.1,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
        }
    }

    return group.children.length > 0 ? group : null;
  }, [modelData, textureMap]);

  if (!group) return null;

  return <primitive object={group} />;
};