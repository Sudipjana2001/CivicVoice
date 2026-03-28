import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fromMock,
  postsSelectMock,
  postsEqMock,
  postsMaybeSingleMock,
  commentsSelectMock,
  commentsInMock,
  commentsIsMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  postsSelectMock: vi.fn(),
  postsEqMock: vi.fn(),
  postsMaybeSingleMock: vi.fn(),
  commentsSelectMock: vi.fn(),
  commentsInMock: vi.fn(),
  commentsIsMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    auth: {
      getUser: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

import { PostService } from '@/services/PostService';

describe('PostService.fetchById', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    postsEqMock.mockReturnValue({ maybeSingle: postsMaybeSingleMock });
    postsSelectMock.mockReturnValue({ eq: postsEqMock });
    commentsInMock.mockReturnValue({ is: commentsIsMock });
    commentsSelectMock.mockReturnValue({ in: commentsInMock });

    fromMock.mockImplementation((table: string) => {
      if (table === 'posts') {
        return { select: postsSelectMock };
      }

      if (table === 'comments') {
        return { select: commentsSelectMock };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('overrides the stored post count with the top-level comment count', async () => {
    postsMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'post-1',
        anonymous_id: 'CVC-001',
        content: 'A report',
        category: 'fraud',
        severity: 'medium',
        evidence_type: null,
        location: null,
        incident_date: null,
        incident_time: null,
        image_url: null,
        created_at: '2026-03-28T00:00:00.000Z',
        credible_votes: 3,
        suspicious_votes: 1,
        comment_count: 4,
        report_count: 0,
        status: 'submitted',
        self_destruct_at: null,
        user_id: null,
        media_assets: null,
      },
      error: null,
    });

    commentsIsMock.mockResolvedValue({
      data: [{ post_id: 'post-1' }],
      error: null,
    });

    const post = await PostService.getInstance().fetchById('post-1');

    expect(post?.commentCount).toBe(1);
    expect(fromMock).toHaveBeenCalledWith('posts');
    expect(fromMock).toHaveBeenCalledWith('comments');
    expect(commentsInMock).toHaveBeenCalledWith('post_id', ['post-1']);
    expect(commentsIsMock).toHaveBeenCalledWith('parent_comment_id', null);
  });
});
