import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Keep for excerpt/meta_description
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Define Zod schema for validation
const postSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(10, "Content must be at least 10 characters"), // Keep validation for the underlying value
  featured_image_url: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  author_name: z.string().optional(),
  author_url: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  status: z.enum(['draft', 'published']),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  meta_keywords: z.string().optional(),
});

type PostFormData = z.infer<typeof postSchema>;

// Define Post type matching backend expectations (with potential nulls)
interface PostData {
    id?: number;
    title: string;
    slug?: string | null;
    excerpt?: string | null;
    content: string;
    featured_image_url?: string | null;
    author_name?: string | null;
    author_url?: string | null;
    status: 'draft' | 'published';
    published_at?: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
    meta_keywords?: string | null;
}


const PostEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!id);
  const isEditing = !!id;

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors } } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      excerpt: '',
      content: '', // Initial content for ReactQuill
      featured_image_url: '',
      author_name: 'Grisma',
      author_url: 'https://grisma.com.np/about',
      status: 'draft',
      meta_title: '',
      meta_description: '',
      meta_keywords: '',
    }
  });

  const watchedTitle = watch('title');

  // --- Fetch post data (useEffect) ---
   useEffect(() => {
    if (isEditing) {
      const fetchPostData = async () => {
        setIsFetching(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
          toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
          navigate('/admin/login');
          return;
        }
        try {
          const response = await fetch(`/api/admin/posts/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error("Failed to fetch post data");
          const data = await response.json();
          if (data.success && data.post) {
             const postData = data.post as PostData;
             reset({
                title: postData.title || '',
                slug: postData.slug || '',
                excerpt: postData.excerpt || '',
                content: postData.content || '', // Set initial content
                featured_image_url: postData.featured_image_url || '',
                author_name: postData.author_name || 'Grisma',
                author_url: postData.author_url || 'https://grisma.com.np/about',
                status: postData.status || 'draft',
                meta_title: postData.meta_title || '',
                meta_description: postData.meta_description || '',
                meta_keywords: Array.isArray(postData.meta_keywords) ? postData.meta_keywords.join(', ') : (postData.meta_keywords || ''),
             });
          } else {
             throw new Error(data.error || "Could not load post");
          }
        } catch (error) {
          console.error("Fetch error:", error);
          toast({ title: "Error", description: `Could not load post: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
           navigate('/admin/dashboard');
        } finally {
          setIsFetching(false);
        }
      };
      fetchPostData();
    }
  }, [id, isEditing, reset, navigate, toast]);


  // --- Slug generation ---
   const generateSlug = (title: string): string => {
     return title
       .toLowerCase()
       .replace(/[^a-z0-9\s-]/g, '')
       .trim()
       .replace(/\s+/g, '-')
       .replace(/-+/g, '-');
   };

    useEffect(() => {
        if (!isEditing && watchedTitle && !watch('slug')) {
            setValue('slug', generateSlug(watchedTitle), { shouldValidate: true });
        }
    }, [watchedTitle, isEditing, setValue, watch]);


  const onSubmit = async (formData: PostFormData) => {
    setIsLoading(true);
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({ title: "Error", description: "Authentication expired.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const apiUrl = isEditing ? `/api/admin/posts/${id}` : '/api/admin/posts';
    const method = isEditing ? 'PUT' : 'POST';

     // Content is already managed by react-hook-form via Controller
     const postPayload: PostData = {
         ...formData,
         slug: formData.slug || (formData.title ? generateSlug(formData.title) : undefined),
         meta_keywords: formData.meta_keywords || null,
     };

     // Ensure optional fields that are empty strings become null
     postPayload.excerpt = postPayload.excerpt || null;
     postPayload.featured_image_url = postPayload.featured_image_url || null;
     postPayload.meta_title = postPayload.meta_title || null;
     postPayload.meta_description = postPayload.meta_description || null;
     postPayload.author_name = postPayload.author_name || 'Grisma';
     postPayload.author_url = postPayload.author_url || 'https://grisma.com.np/about';


    try {
      const response = await fetch(apiUrl, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(postPayload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: "Success", description: `Post ${isEditing ? 'updated' : 'created'} successfully.` });
        navigate('/admin/dashboard');
      } else {
        throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} post`);
      }
    } catch (error) {
      console.error("Save error:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : 'Could not save post.', variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

   if (isFetching) {
     return (
       <Layout>
         <div className="flex justify-center items-center h-[50vh]">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       </Layout>
     );
   }

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['clean']
    ],
    clipboard: {
      matchVisual: false,
    }
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'blockquote', 'code-block',
    'list', 'bullet', 'indent',
    'link', 'image',
    'color', 'background',
    'align'
  ];

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/dashboard')} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">{isEditing ? 'Edit Post' : 'Create New Post'}</CardTitle>
              <CardDescription>{isEditing ? 'Update the details of this post.' : 'Fill in the details for your new post.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
                  <Input id="title" {...register('title')} placeholder="Enter post title" />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
                </div>

                {/* Slug */}
                <div>
                  <label htmlFor="slug" className="block text-sm font-medium mb-1">Slug (URL)</label>
                  <Input id="slug" {...register('slug')} placeholder="e.g., my-awesome-post (optional, generated if empty)" />
                   <p className="text-xs text-muted-foreground mt-1">Leave empty to auto-generate from title. Use lowercase letters, numbers, and hyphens.</p>
                  {errors.slug && <p className="text-xs text-destructive mt-1">{errors.slug.message}</p>}
                </div>


                {/* Excerpt */}
                <div>
                  <label htmlFor="excerpt" className="block text-sm font-medium mb-1">Excerpt (Short Summary)</label>
                  <Textarea id="excerpt" {...register('excerpt')} placeholder="A brief summary for previews" rows={3} />
                  {errors.excerpt && <p className="text-xs text-destructive mt-1">{errors.excerpt.message}</p>}
                </div>

                <div>
                  <label htmlFor="content-editor" className="block text-sm font-medium mb-2">Content</label>
                  <Controller
                      name="content"
                      control={control}
                      rules={{ required: 'Content is required', minLength: { value: 10, message: 'Content must be at least 10 characters'} }}
                      render={({ field }) => (
                          <div className="bg-white rounded-md border">
                            <ReactQuill
                              id="content-editor"
                              theme="snow"
                              value={field.value}
                              onChange={field.onChange}
                              modules={modules}
                              formats={formats}
                              placeholder="Write your post content here... Use the toolbar above to format text, add links, images, and more."
                              className="min-h-[400px]"
                           />
                          </div>
                      )}
                    />
                  {errors.content && <p className="text-xs text-destructive mt-2">{errors.content.message}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Use the rich text editor above for formatting. Supports headings, bold, italic, links, images, code blocks, lists, and more.</p>
                </div>


                {/* Featured Image URL */}
                <div>
                  <label htmlFor="featured_image_url" className="block text-sm font-medium mb-1">Featured Image URL</label>
                  <Input id="featured_image_url" {...register('featured_image_url')} type="url" placeholder="https://example.com/image.jpg" />
                  {errors.featured_image_url && <p className="text-xs text-destructive mt-1">{errors.featured_image_url.message}</p>}
                </div>

                {/* Author Info */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <label htmlFor="author_name" className="block text-sm font-medium mb-1">Author Name</label>
                       <Input id="author_name" {...register('author_name')} placeholder="Grisma" />
                       {errors.author_name && <p className="text-xs text-destructive mt-1">{errors.author_name.message}</p>}
                     </div>
                     <div>
                       <label htmlFor="author_url" className="block text-sm font-medium mb-1">Author URL</label>
                       <Input id="author_url" {...register('author_url')} type="url" placeholder="https://grisma.com.np/about" />
                       {errors.author_url && <p className="text-xs text-destructive mt-1">{errors.author_url.message}</p>}
                     </div>
                 </div>

                {/* Status */}
                <div>
                  <label htmlFor="status" className="block text-sm font-medium mb-1">Status</label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="status" className="w-[180px]">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.status && <p className="text-xs text-destructive mt-1">{errors.status.message}</p>}
                </div>

                 {/* SEO Fields */}
                 <Card className="bg-muted/30">
                     <CardHeader className="pb-4">
                         <CardTitle className="text-lg">SEO Settings (Optional)</CardTitle>
                         <CardDescription>Optimize how this post appears in search results.</CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-4">
                        <div>
                           <label htmlFor="meta_title" className="block text-sm font-medium mb-1">Meta Title</label>
                           <Input id="meta_title" {...register('meta_title')} placeholder="Custom title for search engines" />
                            {errors.meta_title && <p className="text-xs text-destructive mt-1">{errors.meta_title.message}</p>}
                        </div>
                         <div>
                           <label htmlFor="meta_description" className="block text-sm font-medium mb-1">Meta Description</label>
                           <Textarea id="meta_description" {...register('meta_description')} placeholder="Short description for search results" rows={2} />
                            {errors.meta_description && <p className="text-xs text-destructive mt-1">{errors.meta_description.message}</p>}
                        </div>
                         <div>
                           <label htmlFor="meta_keywords" className="block text-sm font-medium mb-1">Keywords</label>
                           <Input id="meta_keywords" {...register('meta_keywords')} placeholder="comma, separated, keywords" />
                           <p className="text-xs text-muted-foreground mt-1">Separate keywords with commas.</p>
                            {errors.meta_keywords && <p className="text-xs text-destructive mt-1">{errors.meta_keywords.message}</p>}
                        </div>
                     </CardContent>
                 </Card>


                {/* Submit Button */}
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => navigate('/admin/dashboard')} disabled={isLoading}>
                       Cancel
                    </Button>
                   <Button type="submit" disabled={isLoading}>
                     {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     {isLoading ? 'Saving...' : (isEditing ? 'Update Post' : 'Create Post')}
                   </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default PostEditor;
