import Head from "next/head";
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import TagDetailsModal from "@/components/TagDetailsModal";
import CategoryManagementModal from "@/components/CategoryManagementModal";
import { TagManager, type TagInfo, type TagCategory, TAG_COLORS } from "@/lib/tag-manager";

export default function Tags() {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<TagInfo | null>(null);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);

  useEffect(() => {
    loadTagsAndCategories();
  }, []);

  const loadTagsAndCategories = async () => {
    try {
      setIsLoading(true);
      const [tagList, managementData] = await Promise.all([
        TagManager.getAllTags(),
        TagManager.getTagManagementData()
      ]);
      setTags(tagList);
      setCategories(managementData.categories);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagClick = (tag: TagInfo) => {
    setSelectedTag(tag);
  };

  const handleTagUpdated = () => {
    setSelectedTag(null);
    loadTagsAndCategories();
  };

  const handleCategoriesUpdated = () => {
    setShowCategoryManagement(false);
    loadTagsAndCategories();
  };

  const getTagColor = (tag: TagInfo): string => {
    const colorKey = TagManager.getTagColor(tag, categories);
    return TAG_COLORS[colorKey];
  };

  return (
    <>
      <Head>
        <title>DishDiary - Tags</title>
      </Head>
      <main className="container">
        <Navigation currentPage="tags" />

        <div className="page-header">
          <h1>Tags</h1>
          <button
            className="secondary-button"
            onClick={() => setShowCategoryManagement(true)}
            title="Manage categories"
          >
            Categories
          </button>
        </div>

        <p className="subtitle">
          {tags.length > 0
            ? `${tags.length} tag${tags.length === 1 ? '' : 's'} across ${categories.length} categories`
            : 'No tags found - add some tags to your dishes to get started!'
          }
        </p>

        {isLoading ? (
          <div className="form">
            <p>Loading tags...</p>
          </div>
        ) : tags.length > 0 ? (
          <div className="tags-grid">
            {tags.map(tag => (
              <button
                key={tag.name}
                className="tag-card"
                onClick={() => handleTagClick(tag)}
                style={{ borderLeft: `4px solid ${getTagColor(tag)}` }}
              >
                <div className="tag-card-header">
                  <span className="tag-name">{tag.name}</span>
                  <span
                    className="tag-color-indicator"
                    style={{ backgroundColor: getTagColor(tag) }}
                  />
                </div>
                <div className="tag-card-details">
                  <span className="tag-count">{tag.count} dish{tag.count === 1 ? '' : 'es'}</span>
                  {tag.category && (
                    <span className="tag-category">
                      {categories.find(c => c.id === tag.category)?.name || tag.category}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="form">
            <p>No tags found yet.</p>
            <p>Start adding tags to your dishes to organize and categorize them!</p>
          </div>
        )}

        {selectedTag && (
          <TagDetailsModal
            tag={selectedTag}
            categories={categories}
            onClose={() => setSelectedTag(null)}
            onUpdated={handleTagUpdated}
          />
        )}

        {showCategoryManagement && (
          <CategoryManagementModal
            categories={categories}
            onClose={() => setShowCategoryManagement(false)}
            onUpdated={handleCategoriesUpdated}
          />
        )}

        <div className="version-indicator">
          v0.2.9
        </div>
      </main>
    </>
  );
}