import { useState } from 'react';
import { Clock, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SELF_DESTRUCT_OPTIONS, type SelfDestructOption } from '@/lib/types';

interface SelfDestructOptionsProps {
  value: SelfDestructOption;
  onChange: (value: SelfDestructOption) => void;
}

export function SelfDestructOptions({ 
  value, 
  onChange,
}: SelfDestructOptionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          {value ? `Deletion request: ${value} days` : 'Request Deletion'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Scheduled Deletion
          </DialogTitle>
          <DialogDescription>
            Choose when CivicVoice should queue this report for deletion during cleanup runs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This is a best-effort deletion request, not an immediate or guaranteed legal erasure of every copy.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Delete After</Label>
            <RadioGroup
              value={value?.toString() || 'null'}
              onValueChange={(v) => onChange(v === 'null' ? null : parseInt(v) as SelfDestructOption)}
              className="space-y-2"
            >
              {SELF_DESTRUCT_OPTIONS.map((option) => (
                <div key={option.value?.toString() || 'null'} className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value={option.value?.toString() || 'null'} 
                    id={`destruct-${option.value}`} 
                  />
                  <Label 
                    htmlFor={`destruct-${option.value}`}
                    className="font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
