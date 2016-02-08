import re, copy
import graphlab as gl

def create_ps(PS_PATH):
    """
    Create a PredictiveService with given S3 paths for logs and the service.
    """
    try:

        ec2 = gl.deploy.Ec2Config(region='us-west-2',
                                        instance_type='m3.xlarge',
                                        aws_access_key_id = os.environ['AWS_ACCESS_KEY_ID'],
                                        aws_secret_access_key = os.environ['AWS_SECRET_ACCESS_KEY'])

        ps = gl.deploy.predictive_service.create('github-search-prod',
                                                       ec2,
                                                       PS_PATH)

        ps.set_CORS("*")

    except:

        ps = gl.deploy.predictive_service.load(PS_PATH)

        print ps

    return ps

def load_all_sframes(repos_path, edges_path, nn_items_path=None , nn_text_path=None):
    """
    uploads all the precomputed sframes, which are the following:
    repos: sframe containing repo_name as unique id, readme, language, watchers, etc...
    edges: sframe containing the edges between repos and watchers, along with the weights
    nn_items: precomputed nearest neighbors for all the repos
    """
    repos = gl.load_sframe(repos_path)
    edges = gl.load_sframe(edges_path)
    nn_items = None
    nn_text = None
    if nn_items_path:
        nn_items = gl.load_sframe( nn_items_path )

    if nn_text_path:
        nn_text = gl.load_sframe( nn_text_path )

    return repos, edges, nn_items, nn_text

def nn_item_model(repos, k=30):
    """
    finds k - nearest neighbors for every repo based on watchers and their associated
    weights.

    returns: nearest items found as well as the nearest neighbors model

    """
    nn_model = gl.nearest_neighbors.create(repos,
                                           distance='weighted_jaccard',
                                           label='repo_name',
                                           features=['user_weights'])


    nn_items = nn_model.query(repos, label='repo_name', k=k)
    nn_items = nn_items.rename({'query_label': 'item_id',
                                'reference_label':'similar',
                                'distance': 'score'})

    nn_items = nn_items[nn_items['score'] > 0]
    nn_items['score'] = 1 - nn_items['score']
    nn_items.save('./nn_items.sframe')

    return nn_model, nn_items

def create_text_features(repos, fields=['description','readme'], topk=10):
    """
    creates text_features based of text containing fields.
    default uses both repo description and repo readme
    for description field, all words are included in the bag of words
    for readme field, only the topk tf_idf features are added to bag of words,
    and the rest is ignored

    returns: sframe that includes repo_names and bag_of_words

    """
    text_features = {}

    for field in fields:
        text = repos[field]
        text = text.apply(lambda x: re.sub('[^a-z]+', ' ', x))
        text = gl.text_analytics.count_ngrams(text, n=1)
        text = text.dict_trim_by_keys(gl.text_analytics.stopwords(),True)

        if field == 'readme':
            text = gl.SFrame(gl.text_analytics.tf_idf(text))
            text = text['docs'].apply(lambda x: sorted(x, key=x.get, reverse=True)[:topk])

        elif field == 'description':
            text = text.dict_keys()

        text = text.apply(lambda x: ' '.join(x))
        text_features[field] = text

    text_features = text_features.values()
    merged_text = text_features[0]

    for text in text_features[1:]:
        merged_text += text

    bow = gl.SFrame(gl.text_analytics.count_words(merged_text))
    bow['repo_name'] = repos['repo_name']
    bow = bow.dropna()
    bow.rename({'X1': 'docs'})

    return bow

def nn_text_model(bow, min_word_count=3, k=50):
    """
    builds a nearest neighbors based on the text features created in
    create_text_features().

    inputs: bow - sframe that includes the text features
            min_word_count - a parameter to ignore all repos that have less
                             than 3 words in their bag of words

    returns: nearest neighbors model based on text similarity
    """
    def filter(doc_terms, min_word_count):
        result = doc_terms

        if len(doc_terms.keys()) <= min_word_count:
            result = {}

        return result

    train = copy.copy(bow)
    train['docs'] = train['docs'].apply(lambda x: filter(x, min_word_count))
    train = train.dropna()
    text_model = gl.nearest_neighbors.create(train,
                                             label='repo_name',
                                             distance='jaccard',
                                             features=['docs']
                                            )

    nn_text_items = text_model.query(train, label='repo_name', k=k)
    nn_text_items = nn_text_items.rename({'query_label': 'item_id',
                                          'reference_label':'similar',
                                          'distance': 'score'})

    nn_text_items = nn_text_items[nn_text_items['score'] > 0]
    nn_text_items['score'] = 1 - nn_text_items['score']
    nn_text_items.save('./nn_text_items.sframe')

    return text_model, nn_text_items

def create_user_sframe(edges, repos):
    joined_edges = edges.join(repos[['repo_name', 'num_watchers']],
                              on='repo_name',
                              how='left')

    joined_edges = joined_edges.sort(['user_name', 'num_watchers'], False)

    user_sf = joined_edges.groupby('user_name',
                       operations={'repos': gl.aggregate.CONCAT('repo_name')})

    return user_sf

def create_graph(nodes, edges):
    g = gl.SGraph()
    g = g.add_vertices(nodes, vid_field='repo_name')
    g = g.add_edges(edges, src_field='item_id', dst_field='similar')
    return g

def upload_user_nerighborhood(ps, graph, user_sf):

    all_users = set(user_sf['user_name'])

    @gl.deploy.required_packages(['networkx==1.9.1'])

    def user_neighborhood(user_name, d1=20, d2=7):
        import networkx

        if user_name not in all_users:
            return '%s is not in the list of users, please choose a different user or repo' % user_name

        try:
            watched_repos = list(user_sf[user_sf['user_name'] == user_name]['repos'][0])
            edges = graph.get_edges(src_ids=watched_repos[:d1])
            second_degree = edges.groupby('__src_id', {'dst': gl.aggregate.CONCAT('__dst_id')})

            def flatten_edges(x):
                return [[x['__src_id'], edge] for edge in x['dst'][:d2]]

            edges = second_degree.flat_map(['__src_id','__dst_id'], lambda x: flatten_edges(x))
            edges = list(edges.filter_by(list(watched_repos), '__dst_id', exclude=True))

            G = networkx.Graph()
            G.add_edges_from([[i['__src_id'], i['__dst_id']] for i in edges])
            G.add_edges_from([[user_name , i['__src_id']] for i in edges])
            pos=networkx.fruchterman_reingold_layout(G)

            verts = list(graph.get_vertices(G.nodes()))
            verts.append({'__id': user_name})

            for vert in verts:
                vert['x'] = int(pos.get(vert['__id'])[0]*10000)
                vert['y'] = int(pos.get(vert['__id'])[1]*10000)

            return {"edges": edges, "verts": verts}

        except Exception as e:
            return 'Exception error: %s' %type(e)

    if (not ps.get_status()[0]['models'] or
        'user_neigh' not in ps.get_predictive_objects_status()['name']):

        ps.add('user_neigh', user_neighborhood)

    else:
        ps.update('user_neigh', user_neighborhood)

    ps.apply_changes()


def upload_repo_neighborhood(ps, graph):

    all_repos = set(graph.get_vertices()['__id'])

    sf = gl.SFrame({'user_id': ['0'], 'item_id': ['0']})
    rec_text = gl.item_similarity_recommender.create(sf,nearest_items=nn_text)

    @gl.deploy.required_packages(['networkx == 1.9.1'])

    def build_neigh(query_repo, k=50):
        import networkx

        if query_repo not in all_repos:
            return '%s is not in the list of repos, please choose a public repo with at least 10 stargazers' % query_repo

        result = None
        try:
            result = graph.get_neighborhood(query_repo, radius=2,)
            verts, edges = result.get_vertices(), result.get_edges()

            similar_text = rec_text.get_similar_items([query_repo], k)
            text_search = verts.filter_by(similar_text['similar'], '__id')
            text_search = list(set(text_search['__id']))

            verts, edges  = list(verts) , list(edges)
            G = networkx.Graph()
            G.add_edges_from([[i['__src_id'], i['__dst_id']] for i in edges])
            pos=networkx.fruchterman_reingold_layout(G)

            for vert in verts:
                vert['x'] = int(pos.get(vert['__id'])[0]*10000)
                vert['y'] = int(pos.get(vert['__id'])[1]*10000)
                vert['text'] = 1 if vert['__id'] in text_search else 0
#                vert['contributros'] = 1 if vert['__id'] in contributors else 0

            return {"edges": edges, "verts": verts, "query": query_repo}

        except Exception as e:
            return 'Exception error: %s' %type(e)

    if (not ps.get_status()[0]['models'] or
        'neigh_search' not in ps.get_predictive_objects_status()['name']):
        ps.add('neigh_search', build_neigh)
    else:
        ps.update('neigh_search', build_neigh)
    ps.apply_changes()


def main(path_repos, path_edges, path_items=None, path_texts=None):

    ps = create_ps('s3://charlie-workspace/github-search-prod/')
    repos, edges, nn_items, nn_text = load_all_sframes(path_repos,
                                                       path_edges,
                                                       path_items,
                                                       path_texts)

    if not nn_text:
        bow = create_text_features(repos, topk=10)
        text_model, nn_text_items = nn_text_model(bow, min_word_count=3, k=50)

    if not nn_items:
        nn_model, nn_items = nn_item_model(repos, k=51)

    filtered_nn = nn_items[nn_items['score']>.015]
    graph = create_graph(repos[['repo_name', 'description', 'is_hot', 'language', 'num_watchers']],
                         filtered_nn[['item_id', 'similar']])

    user_sf = create_user_sframe(filtered_nn , repos)

    upload_repo_neighborhood(ps, graph)
    upload_user_nerighborhood(ps,  graph, user_sf)

if __name__ == '__main__':
    import sys
    path_repos = sys.argv[1]
    path_edges = sys.argv[2]

    path_items = None
    if len(sys.argv) > 2:
        path_items = sys.argv[3]

    path_texts = None
    if len(sys.argv) > 3:
        path_texts = sys.argv[4]

    main()
