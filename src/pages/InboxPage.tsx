import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AnonymousInbox } from '@/components/AnonymousInbox';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Lock, Inbox } from 'lucide-react';

export default function InboxPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <LegalDisclaimer variant="banner" />

      <main className="flex-1 container py-8">
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Inbox className="h-6 w-6 text-primary" />
              Secure Anonymous Inbox
            </h1>
            <p className="text-muted-foreground mt-1">
              Review one-way messages from organizations, journalists, and moderators on the platform.
            </p>
          </div>

          {/* Privacy notice */}
          <Card className="glass-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                    <h3 className="font-medium">Your Privacy is Protected</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        Messages stay inside your CivicVoice inbox
                      </li>
                      <li className="flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        Senders do not see your email or contact information in the inbox UI
                      </li>
                      <li className="flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        Messages are currently one-way
                      </li>
                      <li className="flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        Sender labels help you understand who the message is from
                      </li>
                    </ul>
                  </div>
              </div>
            </CardContent>
          </Card>

          {/* Inbox component */}
          <AnonymousInbox />
        </div>
      </main>

      <Footer />
    </div>
  );
}
