from repo_sim import *

def print_names(result,k=30):
    result=gl.SFrame(result['response']).unpack('X1',  column_name_prefix="")
    print result[['similar', 'rank', 'description', 'language']].print_rows(k)


ps = create_ps('s3://charlie-workspace/github-search/')

# create a recommender model based on nearest items
result = ps.query('search_repos', query_repo='piskvorky/gensim')
print_names(result,k=30)

result = ps.query('search_repos', query_repo='Theano/Theano', k=50)
print_names(result,k=30)

refined = ps.query('refine_repos', last_search=result)
print_names(refined,k=30)

refined = ps.query('refine_repos', last_search=result, is_hot=False, language='Python')
print_names(refined,k=30)

refined = ps.query('refine_repos', last_search=result, is_hot=True, text=True)
print_names(refined,k=30)

result = ps.query('search_repos', query_repo='apache/spark', k=50)
print_names(result,k=30)

refined = ps.query('refine_repos', last_search=result)
print_names(refined,k=30)

refined = ps.query('refine_repos', last_search=result, is_hot=False, language='JavaScript')
print_names(refined,k=30)

refined = ps.query('refine_repos', last_search=result, is_hot=False, contributors=True)
print_names(refined,k=30)

refined = ps.query('refine_repos', last_search=result, is_hot=False, text=True)
print_names(refined,k=30)

result = ps.query('search_repos', query_repo='facebook/planout', k=50)

