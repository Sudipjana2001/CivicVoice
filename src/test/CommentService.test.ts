import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock, selectMock, eqMock, isMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  isMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

import { CommentService } from '@/services/CommentService';

describe('CommentService.fetchByPostId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a total count based on top-level comments only', async () => {
    const postId = 'post-1';
    const baseTimestamp = '2026-03-28T00:00:00.000Z';

    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 'comment-1',
            post_id: postId,
            parent_comment_id: null,
            anonymous_id: 'CVC-001',
            content: 'Top-level comment',
            user_id: 'user-1',
            upvote_count: 0,
            downvote_count: 0,
            created_at: baseTimestamp,
            updated_at: baseTimestamp,
            edited_at: null,
            viewer_reaction: null,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'reply-1',
            post_id: postId,
            parent_comment_id: 'comment-1',
            anonymous_id: 'CVC-002',
            content: 'Nested reply',
            user_id: 'user-2',
            upvote_count: 0,
            downvote_count: 0,
            created_at: '2026-03-28T00:01:00.000Z',
            updated_at: '2026-03-28T00:01:00.000Z',
            edited_at: null,
            viewer_reaction: null,
          },
        ],
        error: null,
      });

    isMock.mockResolvedValue({ count: 1, error: null });
    eqMock.mockReturnValue({ is: isMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });

    const page = await CommentService.getInstance().fetchByPostId(postId);

    expect(page.totalCount).toBe(1);
    expect(page.comments).toHaveLength(1);
    expect(page.comments[0].replies).toHaveLength(1);
    expect(fromMock).toHaveBeenCalledWith('comments');
    expect(selectMock).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(eqMock).toHaveBeenCalledWith('post_id', postId);
    expect(isMock).toHaveBeenCalledWith('parent_comment_id', null);
  });
});
