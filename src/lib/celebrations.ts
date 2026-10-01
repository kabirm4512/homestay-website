/** Special-celebration add-ons offered in the guest portal. Prices are enforced by the server. */
export interface CelebrationOption {
  id: string;
  title: string;
  price: number;
}

export const CELEBRATION_OPTIONS: CelebrationOption[] = [
  { id: 'celebration-cake', title: 'Himalayan Celebration Cake', price: 1000 },
  { id: 'candlelight-dinner', title: 'Candlelight Balcony Dinner & Decor', price: 2000 },
  { id: 'flower-bed-decoration', title: 'Romantic Bed Flower Decoration', price: 1000 },
];

export function findCelebration(id: string): CelebrationOption | undefined {
  return CELEBRATION_OPTIONS.find((c) => c.id === id);
}
