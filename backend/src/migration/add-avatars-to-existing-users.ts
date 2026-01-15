import { PrismaClient } from '@prisma/client';
import { getAvatarUrl, generateRandomSeed } from '../lib/avatar';

const prisma = new PrismaClient();

/**
 * Migration script to add avatars to existing users
 * Generates a random DiceBear avatar URL for each user without an avatar
 */
async function addAvatarsToExistingUsers() {
  try {
    console.log('Starting avatar migration...');

    // Get all users without avatars
    const usersWithoutAvatars = await prisma.user.findMany({
      where: {
        OR: [
          { avatar: null },
          { avatar: '' },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    console.log(`Found ${usersWithoutAvatars.length} users without avatars`);

    let updated = 0;
    for (const user of usersWithoutAvatars) {
      // Generate a random seed - use email as seed for consistency (same email = same avatar)
      const seed = user.email || user.name || generateRandomSeed();
      const avatarUrl = getAvatarUrl(seed);

      await prisma.user.update({
        where: { id: user.id },
        data: { avatar: avatarUrl },
      });

      updated++;
      if (updated % 10 === 0) {
        console.log(`Updated ${updated} users...`);
      }
    }

    console.log(`✅ Successfully added avatars to ${updated} users`);
  } catch (error) {
    console.error('❌ Error adding avatars:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
if (require.main === module) {
  addAvatarsToExistingUsers()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { addAvatarsToExistingUsers };

