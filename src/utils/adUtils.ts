import { Ad } from '../types';

/**
 * Deduplicates an array of ads:
 * 1. Checks unique IDs
 * 2. Checks content signatures (userId + title + price + year + first image) to eliminate exact duplicates
 */
export function deduplicateAds(ads: Ad[]): Ad[] {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: Ad[] = [];

  for (const ad of ads) {
    if (!ad) continue;
    
    // Check ID duplicate
    if (ad.id) {
      if (seenIds.has(ad.id)) continue;
      seenIds.add(ad.id);
    }

    // Check content signature duplicate
    const firstImg = (ad.images && ad.images.length > 0) ? ad.images[0] : '';
    const titleNorm = (ad.title || '').trim().toLowerCase();
    const brandNorm = (ad.brand || '').trim().toLowerCase();
    const modelNorm = (ad.model || '').trim().toLowerCase();
    const userIdNorm = (ad.userId || '').trim();
    const priceNorm = Number(ad.price || 0);
    const yearNorm = Number(ad.year || 0);

    const signature = `${userIdNorm}_${titleNorm}_${brandNorm}_${modelNorm}_${priceNorm}_${yearNorm}_${firstImg}`;

    if (seenSignatures.has(signature)) {
      continue; // Skip duplicate!
    }

    seenSignatures.add(signature);
    result.push(ad);
  }

  return result;
}

/**
 * Retrieves stored local ads from localStorage, filtered for deduplication
 */
export function getStoredLocalAds(): Ad[] {
  try {
    const raw = localStorage.getItem('market_auto_dz_local_ads');
    if (!raw) return [];
    const parsed: Ad[] = JSON.parse(raw);
    return deduplicateAds(parsed);
  } catch {
    return [];
  }
}

/**
 * Merges Firestore ads with local ads, ensuring no duplicate ads are shown.
 * Also cleans up local storage of local ads that match Firestore ads.
 */
export function mergeAndDeduplicateAds(fsAds: Ad[], localAds: Ad[] = getStoredLocalAds()): Ad[] {
  const fsIds = new Set(fsAds.map(a => a.id));
  
  // Filter out local ads that already exist in Firestore by ID or by matching signature
  const fsSignatures = new Set(
    fsAds.map(ad => {
      const firstImg = (ad.images && ad.images.length > 0) ? ad.images[0] : '';
      return `${ad.userId || ''}_${(ad.title || '').trim().toLowerCase()}_${(ad.brand || '').trim().toLowerCase()}_${(ad.model || '').trim().toLowerCase()}_${Number(ad.price || 0)}_${Number(ad.year || 0)}_${firstImg}`;
    })
  );

  const remainingLocal = localAds.filter(l => {
    if (fsIds.has(l.id)) return false;
    const firstImg = (l.images && l.images.length > 0) ? l.images[0] : '';
    const sig = `${l.userId || ''}_${(l.title || '').trim().toLowerCase()}_${(l.brand || '').trim().toLowerCase()}_${(l.model || '').trim().toLowerCase()}_${Number(l.price || 0)}_${Number(l.year || 0)}_${firstImg}`;
    if (fsSignatures.has(sig)) return false;
    return true;
  });

  // Update local storage to clean up redundant local ads
  if (remainingLocal.length !== localAds.length) {
    try {
      localStorage.setItem('market_auto_dz_local_ads', JSON.stringify(remainingLocal));
    } catch (_) {}
  }

  const combined = deduplicateAds([...fsAds, ...remainingLocal]);

  // Sort by newest
  return combined.sort((a, b) => {
    const getTimestamp = (val: any) => {
      if (!val) return 0;
      if (val.seconds) return val.seconds * 1000;
      const parsed = new Date(val).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };
    return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
  });
}
