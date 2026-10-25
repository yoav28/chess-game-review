import Best from './Best';
import Blunder from './Blunder';
import Book from './Book';
import Brilliant from './Brilliant';
import Excellent from './Excellent';
import Forced from './Forced';
import Good from './Good';
import Great from './Great';
import Inaccuracy from './Inaccuracy';
import Miss from './Miss';
import Mistake from './Mistake';

import type { Classification } from '../../lib/review';
import type { SVGProps } from 'react';

interface MoveClassificationProps extends SVGProps<SVGSVGElement> {
  classification: Classification;
}

export default function MoveClassification({ classification, ...props }: MoveClassificationProps) {
  switch (classification) {
    case 'brilliant':
      return <Brilliant {...props} />;
    case 'great':
      return <Great {...props} />;
    case 'best':
      return <Best {...props} />;
    case 'excellent':
      return <Excellent {...props} />;
    case 'good':
      return <Good {...props} />;
    case 'inaccuracy':
      return <Inaccuracy {...props} />;
    case 'mistake':
      return <Mistake {...props} />;
    case 'blunder':
      return <Blunder {...props} />;
    case 'forced':
      return <Forced {...props} />;
    case 'book':
      return <Book {...props} />;
    case 'missed':
      return <Miss {...props} />;
    default:
      return null;
  }
}
