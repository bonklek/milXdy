export const ARTWORK_METADATA_VERSION = 4;

export type ArtworkCacheRecord = {
  artworkDataUrl?: string;
  artworkMetadataVersion?: number;
  artworkFileLastModified?: number;
  artworkFileSize?: number;
};

export type ArtworkFileIdentity = {
  lastModified: number;
  size: number;
};

export function shouldReadEmbeddedArtwork(
  record: ArtworkCacheRecord,
  file: ArtworkFileIdentity,
): boolean {
  if (record.artworkDataUrl) return false;
  return record.artworkMetadataVersion !== ARTWORK_METADATA_VERSION
    || record.artworkFileLastModified !== file.lastModified
    || record.artworkFileSize !== file.size;
}
