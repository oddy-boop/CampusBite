import * as React from 'react';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';

function useUpload() {
  const [loading, setLoading] = React.useState(false);
  const makeCreateUrl = (path) => {
    const base = process.env.EXPO_PUBLIC_PROXY_BASE_URL ?? process.env.EXPO_PUBLIC_BASE_URL;
    if (!base) {
      // In native environments a bare-relative fetch ("/_create/...") will fail because
      // there's no default base; throw a descriptive error so callers see what's wrong.
      throw new Error('Missing EXPO_PUBLIC_PROXY_BASE_URL or EXPO_PUBLIC_BASE_URL environment variable; uploads require a backend URL in native environments.');
    }
    return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  };
  const upload = React.useCallback(async (input) => {
    try {
      setLoading(true);
      const bucket = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET;
      if (!bucket) {
        throw new Error('Missing EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET environment variable; create a Supabase storage bucket and set this value.');
      }

      // Debug: surface runtime capabilities for diagnosing native upload issues
      try {
        // Do not log secrets. Only log presence of globals and input shape.
        // eslint-disable-next-line no-console
        console.debug('[useUpload] bucket=', bucket, 'Buffer=', typeof Buffer !== 'undefined', 'cacheDir=', FileSystem.cacheDirectory, 'docDir=', FileSystem.documentDirectory);
      } catch (e) {}

      // Helper to upload a Blob/File to Supabase Storage and return public URL
      const uploadBlobToBucket = async (blob, fileName) => {
        const path = `menu-items/${Date.now()}-${fileName}`;
        const { data, error: uploadError } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true });
        if (uploadError) {
          // eslint-disable-next-line no-console
          console.error('[useUpload] supabase.upload error', { path, fileName, uploadError, data });
          throw uploadError;
        }
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
        return publicData.publicUrl;
      };

      // Helper to upload raw bytes (Uint8Array / Buffer) to Supabase Storage
      const uploadBytesToBucket = async (bytes, fileName) => {
        const path = `menu-items/${Date.now()}-${fileName}`;
        const { data, error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, { upsert: true });
        if (uploadError) {
          // eslint-disable-next-line no-console
          console.error('[useUpload] supabase.upload bytes error', { path, fileName, uploadError, data });
          throw uploadError;
        }
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
        return publicData.publicUrl;
      };

      // Flow: handle reactNativeAsset (most common path), url, base64, and raw buffer
      if ("reactNativeAsset" in input && input.reactNativeAsset) {
        // eslint-disable-next-line no-console
        console.debug('[useUpload] branch=reactNativeAsset', { uri: input.reactNativeAsset.uri });
        const asset = input.reactNativeAsset;
        // Try to get a Blob from the asset URI (works for file:// and http(s) URIs)
        const uri = asset.uri;
        if (!uri) throw new Error('Asset URI is missing');
        const fileName = asset.name ?? uri.split('/').pop() ?? `upload-${Date.now()}`;

        // If this is a local file URI on React Native, we'll attempt the more robust
        // upload flow below (write to a temp path and upload); fallthrough to the
        // improved local-file handling further down.
          if (uri.startsWith('file:') || uri.startsWith('content:')) {
            try {
              const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
              const filePath = `menu-items/${Date.now()}-${fileName}`;
              const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(filePath)}?upsert=true`;
              // eslint-disable-next-line no-console
              console.debug('[useUpload] temp-file uploadEndpoint=', uploadEndpoint);
              const uploadResult = await FileSystem.uploadAsync(uploadEndpoint, uri, {
                headers: {
                  Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                  apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
                },
                fieldName: 'file',
                mimeType: asset.mimeType || 'application/octet-stream',
              });

              // uploadResult.body is typically a JSON string with info about the uploaded file
              let bodyJson = null;
              try { bodyJson = uploadResult.body ? JSON.parse(uploadResult.body) : null; } catch (e) { bodyJson = null; }

              // Try to extract uploaded path from response; Supabase often returns name/key
              let uploadedPath = filePath;
              if (bodyJson) {
                if (Array.isArray(bodyJson) && bodyJson[0] && bodyJson[0].name) uploadedPath = bodyJson[0].name;
                if (!uploadedPath && bodyJson.Key) uploadedPath = bodyJson.Key;
                if (!uploadedPath && bodyJson.name) uploadedPath = bodyJson.name;
              }

              const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${uploadedPath}`;
              return { url: publicUrl, mimeType: asset.mimeType || null };
            } catch (fsErr) {
              console.warn('Failed to upload local file via FileSystem.uploadAsync, falling back to fetch:', fsErr.message || fsErr);
            }
          }

        // Otherwise try to fetch the file and get a blob
        const res = await fetch(uri);
        const blob = await res.blob();
        const publicUrl = await uploadBlobToBucket(blob, fileName);
        return { url: publicUrl, mimeType: blob.type || null };
      }

      if ("url" in input) {
        // eslint-disable-next-line no-console
        console.debug('[useUpload] branch=url', { url: input.url });
        const url = input.url;
        const fileName = url.split('/').pop() || `remote-${Date.now()}`;
        // If it's a local file on RN, read with FileSystem then upload
        // local file handled in the improved tmp-file upload path below
          if (url.startsWith('file:') || url.startsWith('content:')) {
            try {
              const base64 = await FileSystem.readAsStringAsync(url, { encoding: 'base64' });
              const tmpName = fileName;
              if (!FileSystem.cacheDirectory && !FileSystem.documentDirectory) {
                throw new Error('No file system cache directory available');
              }
              const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
              const tmpPath = cacheDir + tmpName;
              // eslint-disable-next-line no-console
              console.debug('[useUpload] wrote tmpPath for url ->', tmpPath);
              await FileSystem.writeAsStringAsync(tmpPath, base64, { encoding: 'base64' });
              try {
                const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
                const filePath = `menu-items/${Date.now()}-${fileName}`;
                const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(filePath)}?upsert=true`;
                const uploadResult = await FileSystem.uploadAsync(uploadEndpoint, tmpPath, {
                  headers: {
                    Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
                  },
                  fieldName: 'file',
                  mimeType: 'application/octet-stream',
                });

                let bodyJson = null;
                try { bodyJson = uploadResult.body ? JSON.parse(uploadResult.body) : null; } catch (e) { bodyJson = null; }
                let uploadedPath = filePath;
                if (bodyJson) {
                  if (Array.isArray(bodyJson) && bodyJson[0] && bodyJson[0].name) uploadedPath = bodyJson[0].name;
                  if (!uploadedPath && bodyJson.Key) uploadedPath = bodyJson.Key;
                  if (!uploadedPath && bodyJson.name) uploadedPath = bodyJson.name;
                }
                const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${uploadedPath}`;
                try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (e) {}
                return { url: publicUrl, mimeType: null };
              } catch (err2) {
                try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (e) {}
                throw err2;
              }
            } catch (fsErr) {
              console.warn('Failed to read local file via FileSystem, falling back to fetch:', fsErr.message || fsErr);
            }
          }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch remote URL');
        const blob = await res.blob();
        const publicUrl = await uploadBlobToBucket(blob, fileName);
        return { url: publicUrl, mimeType: blob.type || null };
      }

      if ("base64" in input) {
        // eslint-disable-next-line no-console
        console.debug('[useUpload] branch=base64, hasBase64=', !!input.base64);
        const base64 = input.base64;
        const fileName = input.name || `upload-${Date.now()}.jpg`;
        // Prefer Node-style Buffer if available (works in many RN setups and avoids Blob creation)
        try {
          if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            const buf = Buffer.from(base64, 'base64');
            const publicUrl = await uploadBytesToBucket(buf, fileName);
            return { url: publicUrl, mimeType: null };
          }

          // Fallback: try atob -> Uint8Array
          if (typeof atob === 'function') {
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
            const publicUrl = await uploadBytesToBucket(bytes, fileName);
            return { url: publicUrl, mimeType: null };
          }

          // As a last resort, write base64 to a temporary file and upload it (avoids data: protocol)
          const tmpName = input.name || `upload-${Date.now()}.jpg`;
          if (!FileSystem.cacheDirectory && !FileSystem.documentDirectory) {
            throw new Error('No file system cache directory available');
          }
          const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
          const tmpPath = cacheDir + tmpName;
          // eslint-disable-next-line no-console
          console.debug('[useUpload] writing tmp file for base64 ->', tmpPath);
          await FileSystem.writeAsStringAsync(tmpPath, base64, { encoding: 'base64' });
          try {
            const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
            const filePath = `menu-items/${Date.now()}-${tmpName}`;
            const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(filePath)}?upsert=true`;
            const uploadResult = await FileSystem.uploadAsync(uploadEndpoint, tmpPath, {
              headers: {
                Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
              },
              fieldName: 'file',
              mimeType: 'application/octet-stream',
            });

            let bodyJson = null;
            try { bodyJson = uploadResult.body ? JSON.parse(uploadResult.body) : null; } catch (e) { bodyJson = null; }
            let uploadedPath = filePath;
            if (bodyJson) {
              if (Array.isArray(bodyJson) && bodyJson[0] && bodyJson[0].name) uploadedPath = bodyJson[0].name;
              if (!uploadedPath && bodyJson.Key) uploadedPath = bodyJson.Key;
              if (!uploadedPath && bodyJson.name) uploadedPath = bodyJson.name;
            }
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${uploadedPath}`;
            try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (e) {}
            return { url: publicUrl, mimeType: null };
          } catch (err2) {
            try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (e) {}
            throw err2;
          }
        } catch (err) {
          console.warn('Base64 upload failed, falling back to blob flow:', err?.message || err);
          // last chance fallback: data URL -> fetch -> blob
          // Try temp-file upload as a last resort
          try {
            const tmpName = `upload-${Date.now()}.jpg`;
            if (!FileSystem.cacheDirectory && !FileSystem.documentDirectory) {
              throw new Error('No file system cache directory available');
            }
            const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
            const tmpPath = cacheDir + tmpName;
            // eslint-disable-next-line no-console
            console.debug('[useUpload] fallback writing tmp file ->', tmpPath);
            await FileSystem.writeAsStringAsync(tmpPath, base64, { encoding: 'base64' });
            const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
            const filePath = `menu-items/${Date.now()}-${tmpName}`;
            const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(filePath)}?upsert=true`;
            const uploadResult = await FileSystem.uploadAsync(uploadEndpoint, tmpPath, {
              headers: {
                Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
              },
              fieldName: 'file',
              mimeType: 'application/octet-stream',
            });
            let bodyJson = null;
            try { bodyJson = uploadResult.body ? JSON.parse(uploadResult.body) : null; } catch (e) { bodyJson = null; }
            let uploadedPath = filePath;
            if (bodyJson) {
              if (Array.isArray(bodyJson) && bodyJson[0] && bodyJson[0].name) uploadedPath = bodyJson[0].name;
              if (!uploadedPath && bodyJson.Key) uploadedPath = bodyJson.Key;
              if (!uploadedPath && bodyJson.name) uploadedPath = bodyJson.name;
            }
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${uploadedPath}`;
            try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (e) {}
            return { url: publicUrl, mimeType: null };
          } catch (err2) {
            try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (e) {}
            throw err2;
          }
        }
      }

      if (input.buffer) {
        // eslint-disable-next-line no-console
        console.debug('[useUpload] branch=buffer');
        // If raw buffer provided, try to upload directly. Different runtimes
        // have different support for creating Blobs from ArrayBuffers.
        const arrayBuffer = input.buffer instanceof ArrayBuffer ? input.buffer : (input.buffer && input.buffer.buffer) ? input.buffer.buffer : input.buffer;
        const fileName = `upload-${Date.now()}`;

        // Try direct upload (some runtimes accept ArrayBuffer or Buffer)
        try {
          const path = `menu-items/${Date.now()}-${fileName}`;
          const { error: uploadError } = await supabase.storage.from(bucket).upload(path, arrayBuffer, { upsert: true });
          if (uploadError) throw uploadError;
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
          return { url: publicData.publicUrl, mimeType: null };
        } catch (directErr) {
          // Fallback: create a base64 data URL and fetch it to produce a Blob
          const arrayBufferToBase64 = (buffer) => {
            try {
              // If Buffer is available (Node/polyfill), use it
              if (typeof Buffer !== 'undefined') {
                return Buffer.from(buffer).toString('base64');
              }
            } catch (e) {
              // continue to browser fallback
            }

            let binary = '';
            const bytes = new Uint8Array(buffer);
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            if (typeof btoa === 'function') {
              return btoa(binary);
            }
            throw new Error('No base64 encoder available to convert ArrayBuffer');
          };

          const base64 = arrayBufferToBase64(arrayBuffer);
          // Write to temp file and upload via FileSystem.uploadAsync to avoid data: protocol
          const tmpName = `upload-${Date.now()}.bin`;
          const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
          if (!cacheDir) {
            console.error('[useUpload] no cache/document directory available on this runtime');
            return { error: 'No file system cache directory available' };
          }
          const tmpPath = cacheDir + tmpName;
          await FileSystem.writeAsStringAsync(tmpPath, base64, { encoding: 'base64' });
          try {
            const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
            const filePath = `menu-items/${Date.now()}-${tmpName}`;
            const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(filePath)}?upsert=true`;
            const uploadResult = await FileSystem.uploadAsync(uploadEndpoint, tmpPath, {
              headers: {
                Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
              },
              fieldName: 'file',
              mimeType: 'application/octet-stream',
            });

            let bodyJson = null;
            try { bodyJson = uploadResult.body ? JSON.parse(uploadResult.body) : null; } catch (e) { bodyJson = null; }
            let uploadedPath = filePath;
            if (bodyJson) {
              if (Array.isArray(bodyJson) && bodyJson[0] && bodyJson[0].name) uploadedPath = bodyJson[0].name;
              if (!uploadedPath && bodyJson.Key) uploadedPath = bodyJson.Key;
              if (!uploadedPath && bodyJson.name) uploadedPath = bodyJson.name;
            }
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${uploadedPath}`;
            try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (e) {}
            return { url: publicUrl, mimeType: null };
          } catch (err2) {
            try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (e) {}
            throw err2;
          }
        }
      }
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        return { error: uploadError.message };
      }
      if (typeof uploadError === "string") {
        return { error: uploadError };
      }
      return { error: "Upload failed" };
    } finally {
      setLoading(false);
    }
  }, []);

  return [upload, { loading }];
}

export { useUpload };
export default useUpload;