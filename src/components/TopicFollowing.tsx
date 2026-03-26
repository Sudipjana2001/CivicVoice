import { useState } from 'react';
import { Bell, MapPin, Tag, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATEGORIES } from '@/lib/anonymity';
import type { FollowedTopic } from '@/lib/types';

interface TopicFollowingProps {
  followedTopics: FollowedTopic[];
  onFollow: (topic: FollowedTopic) => void;
  onUnfollow: (topic: FollowedTopic) => void;
}

export function TopicFollowing({ followedTopics, onFollow, onUnfollow }: TopicFollowingProps) {
  const [open, setOpen] = useState(false);
  const [topicType, setTopicType] = useState<'location' | 'category'>('category');
  const [locationInput, setLocationInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const handleAddTopic = () => {
    if (topicType === 'location' && locationInput.trim()) {
      onFollow({
        type: 'location',
        value: locationInput.trim().toLowerCase(),
        label: locationInput.trim(),
      });
      setLocationInput('');
    } else if (topicType === 'category' && selectedCategory) {
      const category = CATEGORIES.find(c => c.id === selectedCategory);
      if (category) {
        onFollow({
          type: 'category',
          value: category.id,
          label: category.label,
        });
        setSelectedCategory('');
      }
    }
  };

  const isAlreadyFollowed = (type: 'location' | 'category', value: string) => {
    return followedTopics.some(t => t.type === type && t.value === value.toLowerCase());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bell className="h-4 w-4" />
          Follow Topics
          {followedTopics.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {followedTopics.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Follow Topics
          </DialogTitle>
          <DialogDescription>
            Get notified about new incidents in locations or categories you care about. 
            <span className="block mt-1 text-xs italic">
              Note: You follow topics, not people. No follower counts.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add new topic */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={topicType} onValueChange={(v) => setTopicType(v as 'location' | 'category')}>
                <SelectTrigger className="w-[140px] bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">
                    <span className="flex items-center gap-2">
                      <Tag className="h-3 w-3" />
                      Category
                    </span>
                  </SelectItem>
                  <SelectItem value="location">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      Location
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {topicType === 'location' ? (
                <Input
                  placeholder="Enter a town, village, street, or lane..."
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  className="flex-1 bg-muted/50"
                />
              ) : (
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="flex-1 bg-muted/50">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter(c => !isAlreadyFollowed('category', c.id)).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button 
                size="icon" 
                onClick={handleAddTopic}
                disabled={
                  (topicType === 'location' && (!locationInput.trim() || isAlreadyFollowed('location', locationInput.trim()))) ||
                  (topicType === 'category' && !selectedCategory)
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Current followed topics */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Currently Following</h4>
            {followedTopics.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No topics followed yet. Add locations or categories above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {followedTopics.map((topic) => (
                  <Badge 
                    key={`${topic.type}-${topic.value}`}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {topic.type === 'location' ? (
                      <MapPin className="h-3 w-3" />
                    ) : (
                      <Tag className="h-3 w-3" />
                    )}
                    {topic.label}
                    <button
                      onClick={() => onUnfollow(topic)}
                      className="ml-1 p-0.5 hover:bg-muted rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
