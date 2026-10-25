import type { FeedCard } from '../../feed/build-feed';
import { WaitingCard } from './WaitingCard';
import { PrioritiesCard } from './PrioritiesCard';
import { ComingUpCard } from './ComingUpCard';
import { ProposalsCard } from './ProposalsCard';
import { LastMeetingCard } from './LastMeetingCard';
import { ThisWeekCard } from './ThisWeekCard';
import { FromChatCard } from './FromChatCard';
import { RecentlySharedCard } from './RecentlySharedCard';
import { AskCard } from './AskCard';
import { cardQuestion } from '../../feed/card-question';
import styles from './cards.module.css';

function renderCard(card: FeedCard, now: Date): React.ReactNode {
  switch (card.type) {
    case 'waiting':
      return <WaitingCard tasks={card.tasks} />;
    case 'priorities':
      return <PrioritiesCard initiatives={card.initiatives} />;
    case 'coming-up':
      return <ComingUpCard events={card.events} />;
    case 'proposals':
      return <ProposalsCard proposals={card.proposals} />;
    case 'last-meeting':
      return <LastMeetingCard meeting={card.meeting} />;
    case 'this-week':
      return <ThisWeekCard top={card.top} openItems={card.openItems} />;
    case 'from-chat':
      return <FromChatCard threads={card.threads} now={now} />;
    case 'recently-shared':
      return <RecentlySharedCard shares={card.shares} now={now} />;
  }
}

/** The home feed's cards, in the order buildFeed returns them. Tapping one asks the chat about it. */
export function FeedCards({ cards, now }: { cards: FeedCard[]; now: Date }) {
  return (
    <div className={styles.feed}>
      {cards.map((card) => (
        <AskCard key={card.type} question={cardQuestion(card)}>
          {renderCard(card, now)}
        </AskCard>
      ))}
    </div>
  );
}
