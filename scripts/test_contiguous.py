import json

def combine_pages_for_hymn(pages_list):
    # If we have a list of pages where a target was found, e.g. [104, 105],
    # we want to retain all of them if they are contiguous.
    if not pages_list:
        return []
    
    pages_list.sort()
    
    result_pages = []
    
    # We always take the first one
    result_pages.append(pages_list[0])
    
    # Take contiguous pages up to a reasonable limit (e.g. 6 pages max for a hymn)
    # The image shows "Page 1 of 2", so multi-page happens.
    for p in pages_list[1:]:
        if p == result_pages[-1] + 1:
            result_pages.append(p)
        else:
            # gap in pages means it's a false positive or completely different occurrence elsewhere
            break
            
    return result_pages

print(combine_pages_for_hymn([104, 105]))
print(combine_pages_for_hymn([65, 89, 90]))
print(combine_pages_for_hymn([1]))
print(combine_pages_for_hymn([]))
