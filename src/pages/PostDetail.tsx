import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CalendarDays, User, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DOMPurify from 'dompurify'; // Import DOMPurify
import ShareButtons from '@/components/ShareButtons';

// Define the structure for a single post
interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  author_name: string | null;
  author_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null; // Stored as comma-separated string
}

const PostDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) {
        setError("Post slug is missing.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        // Fetch from the public /api/posts/:slug endpoint
        const response = await fetch(`/api/posts/${slug}`); 
        
        if (response.status === 404) {
          throw new Error('Post not found.');
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.post) {
          setPost(data.post);
          // TODO: Implement react-helmet-async to set document.title
          // document.title = data.post.meta_title || data.post.title;
        } else {
          throw new Error(data.error || 'Invalid data format received.');
        }
      } catch (err) {
        console.error("Failed to fetch post:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [slug]); // Re-fetch if slug changes

  // Helper function to format date
  const formatDateString = (dateString: string | null) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z');
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return dateString;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-10 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !post) {
    return (
      <Layout>
        <div className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
             <Link to="/posts">
                <Button variant="ghost" className="mb-6">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Posts
                </Button>
             </Link>
            <h1 className="text-3xl font-bold mb-4 text-destructive">
              {error ? "Error Loading Post" : "Post Not Found"}
            </h1>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error || "The post you're looking for doesn't seem to exist or is not published."}</AlertDescription>
            </Alert>
          </div>
        </div>
      </Layout>
    );
  }

  // Safely split keywords
  const keywords = post.meta_keywords ? post.meta_keywords.split(',').map(k => k.trim()).filter(Boolean) : [];

  return (
    <Layout>
      <article className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
           <Link to="/posts" className="inline-block mb-8">
             <Button variant="outline" size="sm">
               <ArrowLeft className="h-4 w-4 mr-2" />
               Back to All Posts
             </Button>
           </Link>

          {post.featured_image_url && (
            <img
              src={post.featured_image_url}
              alt={post.title}
              className="w-full h-auto max-h-[500px] object-cover rounded-lg mb-8 shadow-md border"
              loading="lazy"
            />
          )}

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 leading-tight">{post.title}</h1>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 border-b pb-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {post.author_name && (
                <div className="flex items-center gap-1.5">
                   <User className="h-4 w-4" />
                   {post.author_url ? (
                     <a href={post.author_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                       {post.author_name}
                     </a>
                   ) : (
                     <span>{post.author_name}</span>
                   )}
                </div>
              )}
              {post.published_at && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  <time dateTime={post.published_at}>{formatDateString(post.published_at)}</time>
                </div>
              )}
              {post.updated_at && post.published_at && new Date(post.updated_at).toDateString() !== new Date(post.published_at).toDateString() && (
                <div className="flex items-center gap-1.5 text-xs italic">(Updated: {formatDateString(post.updated_at)})</div>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <ShareButtons 
                title={post.title}
                className="flex-nowrap"
              />
            </div>
          </div>

          {/* Render post content using DOMPurify to sanitize */}
          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
          />

          {keywords.length > 0 && (
             <div className="mt-10 pt-6 border-t">
               <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Keywords:</h4>
               <div className="flex flex-wrap gap-2">
                 {keywords.map((keyword, index) => (
                   <Badge key={index} variant="secondary">{keyword}</Badge>
                 ))}
               </div>
             </div>
          )}

        </div>
      </article>
    </Layout>
  );
};

export default PostDetail;
