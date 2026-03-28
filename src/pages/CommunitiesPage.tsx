import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommunitiesView } from '@/components/network/CommunitiesView';
import { ConnectionsView } from '@/components/network/ConnectionsView';
import { Users, UserPlus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function CommunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'communities';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Civic Network</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with local communities and like-minded citizens.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
            <TabsTrigger value="communities" className="text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Users className="h-4 w-4 mr-2" />
              Communities
            </TabsTrigger>
            <TabsTrigger value="connections" className="text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <UserPlus className="h-4 w-4 mr-2" />
              Connections
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="communities" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <CommunitiesView />
          </TabsContent>
          
          <TabsContent value="connections" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ConnectionsView />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
