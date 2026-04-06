export async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

export async function saveChunkToOPFS(
  videoId: string,
  chunkIndex: number,
  data: ArrayBuffer,
  iv: Uint8Array
): Promise<void> {
  const root = await getOPFSRoot();
  const videoDir = await root.getDirectoryHandle(videoId, { create: true });

  // Save encrypted chunk
  const chunkFile = await videoDir.getFileHandle(`chunk_${chunkIndex}`, { create: true });
  const writable = await chunkFile.createWritable();
  await writable.write(data);
  await writable.close();

  // Save IV
  const ivFile = await videoDir.getFileHandle(`iv_${chunkIndex}`, { create: true });
  const ivWritable = await ivFile.createWritable();
  await ivWritable.write(new Uint8Array(iv) as unknown as BufferSource);
  await ivWritable.close();
}

export async function readChunkFromOPFS(
  videoId: string,
  chunkIndex: number
): Promise<{ data: ArrayBuffer; iv: Uint8Array } | null> {
  try {
    const root = await getOPFSRoot();
    const videoDir = await root.getDirectoryHandle(videoId);

    const chunkFile = await videoDir.getFileHandle(`chunk_${chunkIndex}`);
    const chunkBlob = await chunkFile.getFile();
    const data = await chunkBlob.arrayBuffer();

    const ivFile = await videoDir.getFileHandle(`iv_${chunkIndex}`);
    const ivBlob = await ivFile.getFile();
    const iv = new Uint8Array(await ivBlob.arrayBuffer());

    return { data, iv };
  } catch {
    return null;
  }
}

export async function getChunkCount(videoId: string): Promise<number> {
  try {
    const root = await getOPFSRoot();
    const videoDir = await root.getDirectoryHandle(videoId);
    let count = 0;
    for await (const [name] of (videoDir as any).entries()) {
      if (name.startsWith("chunk_")) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

export async function deleteVideoFromOPFS(videoId: string): Promise<void> {
  try {
    const root = await getOPFSRoot();
    await root.removeEntry(videoId, { recursive: true });
  } catch {
    // Video not found, ignore
  }
}

export async function isVideoOffline(videoId: string): Promise<boolean> {
  const count = await getChunkCount(videoId);
  return count > 0;
}
