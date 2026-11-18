import React from 'react';
import TagsInput from './TagsInput';
import TagRecommendations from './TagRecommendations';
import FormFieldLabel from './FormFieldLabel';
import CharCounter from './CharCounter';

/**
 * Tag editor with the shared label, counter and AI recommendations, so the
 * character and entity forms expose the exact same tag behaviour.
 */
export default function FormTagsField({
  tags,
  onChange,
  maxTags,
  sourceText,
  hint = '第一个标签会显示在封面上。',
}) {
  return (
    <div className="mb-4 position-relative">
      <FormFieldLabel required hint={hint}>标签</FormFieldLabel>
      <TagsInput tags={tags} setTags={onChange} maxTags={maxTags} placeholder="输入后按Enter添加" />
      <CharCounter value={tags.length} max={maxTags} suffix="个标签" />
      <TagRecommendations
        currentTags={tags}
        onAddTag={tag => onChange([...tags, tag])}
        sourceText={sourceText}
        maxTags={maxTags}
      />
    </div>
  );
}
