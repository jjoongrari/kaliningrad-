import Game from '@/components/Game';
import listings from '../../public/data/listings.json';
import catalogMeta from '../../public/data/catalog-meta.json';
import type { Listing } from '@/lib/game';
export default function Page() { return <Game initialListing={listings[0] as Listing} initialCount={listings.length} catalogMeta={catalogMeta} />; }
