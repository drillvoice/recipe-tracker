import { act, render, screen, waitFor } from '@testing-library/react';
import IdeasTableRow from '@/components/IdeasTableRow';
import {
  TAG_COLORS,
  TAG_MANAGEMENT_UPDATED_EVENT,
  TagManager,
  type TagCategory,
  type TagManagementData
} from '@/lib/tag-manager';
import type { Idea } from '@/hooks/useIdeas';

jest.mock('@/lib/tag-manager', () => {
  const actual = jest.requireActual('@/lib/tag-manager');
  return {
    ...actual,
    TagManager: {
      ...actual.TagManager,
      getTagManagementData: jest.fn()
    }
  };
});

const mockedTagManager = TagManager as jest.Mocked<typeof TagManager>;

const createMockTimestamp = (isoString: string): Idea['lastMade'] => ({
  toDate: () => new Date(isoString),
  toMillis: () => new Date(isoString).getTime()
} as unknown as Idea['lastMade']);

const createIdea = (overrides: Partial<Idea> = {}): Idea => ({
  mealName: 'Test Meal',
  lastMade: createMockTimestamp('2024-01-01T00:00:00Z'),
  count: 1,
  hidden: false,
  tags: ['Spicy'],
  ...overrides
});

const renderRow = (idea: Idea) =>
  render(
    <table>
      <tbody>
        <IdeasTableRow idea={idea} onConfirmHide={jest.fn()} />
      </tbody>
    </table>
  );

const createTagManagementData = (data: Partial<TagManagementData>) => ({
  categories: [],
  tags: {},
  ...data
}) as TagManagementData;

describe('IdeasTableRow tag metadata caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads tag metadata once and reuses cached colors on re-render', async () => {
    const categories: TagCategory[] = [
      { id: 'spice', name: 'Spice', color: 'pink', createdAt: Date.now() }
    ];
    mockedTagManager.getTagManagementData.mockReturnValue(
      createTagManagementData({
        categories,
        tags: {
          Spicy: { category: 'spice' }
        }
      })
    );

    const idea = createIdea();
    const { rerender } = renderRow(idea);

    await waitFor(() =>
      expect(mockedTagManager.getTagManagementData).toHaveBeenCalledTimes(1)
    );

    expect(screen.getByText('Spicy')).toHaveStyle(
      `background-color: ${TAG_COLORS.pink}`
    );

    rerender(
      <table>
        <tbody>
          <IdeasTableRow
            idea={{ ...idea, count: 2 }}
            onConfirmHide={jest.fn()}
          />
        </tbody>
      </table>
    );

    expect(mockedTagManager.getTagManagementData).toHaveBeenCalledTimes(1);
  });

  it('refreshes cached metadata when tag settings change', async () => {
    const initialData = createTagManagementData({
      categories: [
        { id: 'spice', name: 'Spice', color: 'pink', createdAt: Date.now() }
      ],
      tags: {
        Spicy: { category: 'spice' }
      }
    });

    const updatedData = createTagManagementData({
      categories: [
        { id: 'spice', name: 'Spice', color: 'blue', createdAt: Date.now() }
      ],
      tags: {
        Spicy: { category: 'spice' }
      }
    });

    let currentData = initialData;
    mockedTagManager.getTagManagementData.mockImplementation(() => currentData);

    renderRow(createIdea());

    await waitFor(() =>
      expect(mockedTagManager.getTagManagementData).toHaveBeenCalledTimes(1)
    );

    await waitFor(() =>
      expect(screen.getByText('Spicy')).toHaveStyle(
        `background-color: ${TAG_COLORS.pink}`
      )
    );

    act(() => {
      currentData = updatedData;
      window.dispatchEvent(new CustomEvent(TAG_MANAGEMENT_UPDATED_EVENT));
    });

    await waitFor(() =>
      expect(mockedTagManager.getTagManagementData).toHaveBeenCalledTimes(2)
    );

    await waitFor(() =>
      expect(screen.getByText('Spicy')).toHaveStyle(
        `background-color: ${TAG_COLORS.blue}`
      )
    );
  });

  it('falls back to gray when metadata is unavailable', async () => {
    mockedTagManager.getTagManagementData.mockReturnValue(
      createTagManagementData({ tags: {} })
    );

    renderRow(createIdea({ tags: ['Unknown'] }));

    await waitFor(() =>
      expect(mockedTagManager.getTagManagementData).toHaveBeenCalledTimes(1)
    );

    expect(screen.getByText('Unknown')).toHaveStyle(
      `background-color: ${TAG_COLORS.gray}`
    );
  });
});

