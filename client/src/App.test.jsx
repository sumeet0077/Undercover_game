import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Client Sanity Check', () => {
    it('should be able to render minimal react', () => {
        const TestComponent = () => <div>Hello Test World</div>;
        render(<TestComponent />);
        expect(screen.getByText('Hello Test World')).toBeInTheDocument();
    });

    it('basic math', () => {
        expect(1 + 1).toBe(2);
    });
});
