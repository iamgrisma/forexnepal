import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, BookOpen, AlertCircle } from 'lucide-react';

// Define a type for your post structure
interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  author_name: string | null;
  author_url: string | null;
  published_at: string | null;
}

const Posts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/posts'); // Fetch from the public API
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.posts)) {
          setPosts(data.posts);
        } else {
          throw new Error(data.error || 'Invalid data format received from API');
        }
      } catch (err) {
        console.error("Failed to fetch posts:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []); // Fetch only once on mount

  return (
    <Layout>
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
             <BookOpen className="h-12 w-12 mx-auto mb-4 text-primary" />
             <h1 className="text-4xl font-bold text-gray-900 mb-2">Blog Posts</h1>
             <p className="text-lg text-gray-600">Updates and insights related to ForexNepal.</p>
          </div>

          {error && (
             <Alert variant="destructive" className="mb-8">
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>Error</AlertTitle>
               <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {isLoading ? (
              // Skeleton Loading
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                   <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                   <CardHeader>
                     <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                     <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                   </CardHeader>
                   <CardContent>
                     <div className="h-4 bg-gray-200 rounded mb-2"></div>
                     <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                   </CardContent>
                </Card>
              ))
            ) : posts && posts.length > 0 ? (
              // Display Posts
              posts.map((post) => (
                <Card key={post.id} className="hover:shadow-lg transition-shadow duration-300 flex flex-col">
                   {post.featured_image_url && (
                       <img
                         src={post.featured_image_url}
                         alt={post.title}
                         className="w-full h-48 object-cover rounded-t-lg"
                         loading="lazy"
                       />
                   )}
                  <CardHeader>
                    <CardTitle className="text-xl lg:text-2xl leading-tight">
                      <Link to={`/posts/${post.slug}`} className="hover:text-primary transition-colors">
                        {post.title}
                      </Link>
                    </CardTitle>
                     {post.published_at && (
                       <p className="text-sm text-muted-foreground pt-1">
                         Published on {new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                       </p>
                     )}
                  </CardHeader>
                  <CardContent className="flex-grow">
                     {post.excerpt && (
                       <p className="text-muted-foreground line-clamp-3 mb-4">{post.excerpt}</p>
                     )}
                     <Link
                       to={`/posts/${post.slug}`}
                       className="text-primary hover:underline font-medium text-sm inline-flex items-center gap-1"
                     >
                       Read more <span aria-hidden="true">→</span>
                     </Link>
                  </CardContent>
                </Card>
              ))
            ) : (
              // No Posts Found
              <div className="col-span-1 md:col-span-2 text-center py-16">
                 <BookOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-xl text-muted-foreground">No posts published yet.</p>
                <p className="text-sm text-gray-400 mt-2">Check back later for updates!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Posts;
