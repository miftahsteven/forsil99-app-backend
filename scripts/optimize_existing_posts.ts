import { prisma } from '../src/lib/prisma.js';
import { optimizePostMedia, optimizeMemoryMeta, optimizeImageBase64 } from '../src/services/imageService.js';

async function runOptimization() {
  console.log('=== Memulai Optimasi Gambar Database Forsil 99 ===\n');

  // 1. Optimasi Postingan
  const posts = await prisma.post.findMany();
  console.log(`Ditemukan ${posts.length} postingan. Memeriksa gambar...`);

  let optimizedPostCount = 0;
  for (const post of posts) {
    const rawMedia = Array.isArray(post.media) ? (post.media as any[]) : [];
    const rawMeta = post.memoryMeta as any;

    const initialMediaBytes = JSON.stringify(rawMedia).length;
    const initialMetaBytes = JSON.stringify(rawMeta || {}).length;

    const optimizedMedia = await optimizePostMedia(rawMedia);
    const optimizedMeta = await optimizeMemoryMeta(rawMeta);

    const finalMediaBytes = JSON.stringify(optimizedMedia).length;
    const finalMetaBytes = JSON.stringify(optimizedMeta || {}).length;

    const changed = initialMediaBytes !== finalMediaBytes || initialMetaBytes !== finalMetaBytes;

    if (changed) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          media: optimizedMedia,
          memoryMeta: optimizedMeta,
        },
      });
      optimizedPostCount++;
      const savedBytes = (initialMediaBytes + initialMetaBytes) - (finalMediaBytes + finalMetaBytes);
      console.log(`✅ Post [${post.id.slice(0, 8)}]: Media ${rawMedia.length} foto. Ukuran turun dari ${(initialMediaBytes / 1024 / 1024).toFixed(2)} MB -> ${(finalMediaBytes / 1024 / 1024).toFixed(2)} MB (Hemat ${(savedBytes / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.log(`ℹ️ Post [${post.id.slice(0, 8)}]: Sudah optimal (${(initialMediaBytes / 1024).toFixed(1)} KB)`);
    }
  }

  // 2. Optimasi Foto Profil
  const profiles = await prisma.profile.findMany();
  console.log(`\nDitemukan ${profiles.length} profil. Memeriksa foto profil...`);

  let optimizedProfileCount = 0;
  for (const prof of profiles) {
    let updatedPhoto = prof.profilePhotoUrl;
    let updatedCover = prof.coverPhotoUrl;
    let profChanged = false;

    if (prof.profilePhotoUrl && prof.profilePhotoUrl.startsWith('data:image')) {
      const origLen = prof.profilePhotoUrl.length;
      if (origLen > 50000) { // If larger than ~50KB
        updatedPhoto = await optimizeImageBase64(prof.profilePhotoUrl, { maxDimension: 600, quality: 80 });
        profChanged = true;
        console.log(`✅ Profil [${prof.fullName}]: Foto profil turun dari ${(origLen / 1024).toFixed(1)} KB -> ${(updatedPhoto.length / 1024).toFixed(1)} KB`);
      }
    }

    if (prof.coverPhotoUrl && prof.coverPhotoUrl.startsWith('data:image')) {
      const origLen = prof.coverPhotoUrl.length;
      if (origLen > 100000) {
        updatedCover = await optimizeImageBase64(prof.coverPhotoUrl, { maxDimension: 1200, quality: 80 });
        profChanged = true;
        console.log(`✅ Profil [${prof.fullName}]: Cover turun dari ${(origLen / 1024).toFixed(1)} KB -> ${(updatedCover.length / 1024).toFixed(1)} KB`);
      }
    }

    if (profChanged) {
      await prisma.profile.update({
        where: { id: prof.id },
        data: {
          profilePhotoUrl: updatedPhoto,
          coverPhotoUrl: updatedCover,
        },
      });
      optimizedProfileCount++;
    }
  }

  // 3. Optimasi Stories
  const stories = await prisma.story.findMany();
  console.log(`\nDitemukan ${stories.length} stories. Memeriksa stories...`);
  for (const story of stories) {
    if (story.mediaType === 'image' && story.mediaUrl.startsWith('data:image') && story.mediaUrl.length > 200000) {
      const origLen = story.mediaUrl.length;
      const opt = await optimizeImageBase64(story.mediaUrl, { imageCount: 1, maxDimension: 1200, quality: 75 });
      await prisma.story.update({
        where: { id: story.id },
        data: { mediaUrl: opt },
      });
      console.log(`✅ Story [${story.id.slice(0, 8)}]: Ukuran turun dari ${(origLen / 1024).toFixed(1)} KB -> ${(opt.length / 1024).toFixed(1)} KB`);
    }
  }

  console.log(`\n🎉 Selesai! Berhasil mengoptimasi ${optimizedPostCount} postingan dan ${optimizedProfileCount} profil.`);
}

runOptimization()
  .catch((err) => {
    console.error('Error running optimization:', err);
  })
  .finally(() => {
    prisma.$disconnect();
  });
