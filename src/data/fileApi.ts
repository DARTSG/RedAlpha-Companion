/**
 * fileApi — uploads files to SharePoint via the `sharepoint-upload` Supabase
 * Edge Function (the Graph credentials live ONLY in the function's secrets).
 * Supabase stores just the returned SharePoint URL.
 *
 * Demo mode (no Supabase): returns the local URI so the UI still works.
 */

import { Platform } from 'react-native';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export type FileKind = 'cv' | 'jd' | 'performance-report' | 'syllabus';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result ?? '');
      resolve(res.slice(res.indexOf(',') + 1)); // strip data: prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function readAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    return blobToBase64(await resp.blob());
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system');
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}

export async function uploadFileToSharePoint(opts: {
  kind: FileKind;
  ownerId: string;        // student userId / intake programme id the file belongs to
  filename: string;
  uri: string;            // local/blob URI from the document picker
  mimeType?: string;
}): Promise<{ url: string; filename: string }> {
  if (!isSupabaseConfigured) return { url: opts.uri, filename: opts.filename }; // demo mode
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Backend not configured.');
  const contentBase64 = await readAsBase64(opts.uri);
  const { data, error } = await sb.functions.invoke('sharepoint-upload', {
    body: {
      kind: opts.kind,
      ownerId: opts.ownerId,
      filename: opts.filename,
      mimeType: opts.mimeType ?? 'application/octet-stream',
      contentBase64,
    },
  });
  if (error) throw new Error(error.message ?? 'Upload failed');
  if (!data?.url) throw new Error(data?.error ?? 'Upload failed — is the SharePoint function configured?');
  return { url: data.url as string, filename: opts.filename };
}
