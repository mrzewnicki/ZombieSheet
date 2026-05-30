import { writeBatch, doc, type CollectionReference } from 'firebase/firestore'
import { db } from '@/config/firebase'

export async function persistGearListOrder(
  collectionRef: CollectionReference,
  orderedIds: string[],
): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(collectionRef, id), { sortOrder: index + 1 })
  })
  await batch.commit()
}
