import PropTypes from 'prop-types';

import { FormattedMessage } from 'react-intl';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import { debounce } from 'lodash';

import { TimelineHint } from 'mastodon/components/timeline_hint';
import BundleColumnError from 'mastodon/features/ui/components/bundle_column_error';
import { normalizeForLookup } from 'mastodon/reducers/accounts_map';
import { getAccountHidden } from 'mastodon/selectors';

import {
  lookupAccount,
  fetchAccount,
  fetchFollowing,
  expandFollowing,
} from '../../actions/accounts';
import { ColumnBackButton } from '../../components/column_back_button';
import { LoadingIndicator } from '../../components/loading_indicator';
import ScrollableList from '../../components/scrollable_list';
import AccountContainer from '../../containers/account_container';
import LimitedAccountHint from '../account_timeline/components/limited_account_hint';
import HeaderContainer from '../account_timeline/containers/header_container';
import Column from '../ui/components/column';

const mapStateToProps = (state, { params: { acct, id } }) => {
  const accountId = id || state.getIn(['accounts_map', normalizeForLookup(acct)]);

  if (!accountId) {
    return {
      isLoading: true,
    };
  }

  return {
    accountId,
    remote: !!(state.getIn(['accounts', accountId, 'acct']) !== state.getIn(['accounts', accountId, 'username'])),
    remoteUrl: state.getIn(['accounts', accountId, 'url']),
    isAccount: !!state.getIn(['accounts', accountId]),
    accountIds: state.getIn(['user_lists', 'following', accountId, 'items']),
    hasMore: !!state.getIn(['user_lists', 'following', accountId, 'next']),
    isLoading: state.getIn(['user_lists', 'following', accountId, 'isLoading'], true),
    suspended: state.getIn(['accounts', accountId, 'suspended'], false),
    hidden: getAccountHidden(state, accountId),
    blockedBy: state.getIn(['relationships', accountId, 'blocked_by'], false),
  };
};

const RemoteHint = ({ url }) => (
  <TimelineHint url={url} resource={<FormattedMessage id='timeline_hint.resources.follows' defaultMessage='Follows' />} />
);

RemoteHint.propTypes = {
  url: PropTypes.string.isRequired,
};

class Following extends ImmutablePureComponent {

  static propTypes = {
    params: PropTypes.shape({
      acct: PropTypes.string,
      id: PropTypes.string,
    }).isRequired,
    accountId: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    accountIds: ImmutablePropTypes.list,
    hasMore: PropTypes.bool,
    isLoading: PropTypes.bool,
    blockedBy: PropTypes.bool,
    isAccount: PropTypes.bool,
    suspended: PropTypes.bool,
    hidden: PropTypes.bool,
    remote: PropTypes.bool,
    remoteUrl: PropTypes.string,
    multiColumn: PropTypes.bool,
  };

  _load () {
    const { accountId, isAccount, dispatch } = this.props;

    if (!isAccount) dispatch(fetchAccount(accountId));
    dispatch(fetchFollowing(accountId));
  }

  componentDidMount () {
    const { params: { acct }, accountId, dispatch } = this.props;

    if (accountId) {
      this._load();
    } else {
      dispatch(lookupAccount(acct));
    }
  }

  componentDidUpdate (prevProps) {
    const { params: { acct }, accountId, dispatch } = this.props;

    if (prevProps.accountId !== accountId && accountId) {
      this._load();
    } else if (prevProps.params.acct !== acct) {
      dispatch(lookupAccount(acct));
    }
  }

  handleLoadMore = debounce(() => {
    this.props.dispatch(expandFollowing(this.props.accountId));
  }, 300, { leading: true });

  render () {
    const { accountId, accountIds, hasMore, blockedBy, isAccount, multiColumn, isLoading, suspended, hidden, remote, remoteUrl } = this.props;

    if (!isAccount) {
      return (
        <BundleColumnError multiColumn={multiColumn} errorType='routing' />
      );
    }

    if (!accountIds) {
      return (
        <Column>
          <LoadingIndicator />
        </Column>
      );
    }

    let emptyMessage;

    const forceEmptyState = blockedBy || suspended || hidden;

    if (suspended) {
      emptyMessage = <FormattedMessage id='empty_column.account_suspended' defaultMessage='Account suspended' />;
    } else if (hidden) {
      emptyMessage = <LimitedAccountHint accountId={accountId} />;
    } else if (blockedBy) {
      emptyMessage = <FormattedMessage id='empty_column.account_unavailable' defaultMessage='Profile unavailable' />;
    } else if (remote && accountIds.isEmpty()) {
      emptyMessage = <RemoteHint url={remoteUrl} />;
    } else {
      emptyMessage = <FormattedMessage id='account.follows.empty' defaultMessage="This user doesn't follow anyone yet." />;
    }

    const remoteMessage = remote ? <RemoteHint url={remoteUrl} /> : null;

    return (
      <Column>
        <ColumnBackButton />

        <ScrollableList
          scrollKey='following'
          hasMore={!forceEmptyState && hasMore}
          isLoading={isLoading}
          onLoadMore={this.handleLoadMore}
          prepend={<HeaderContainer accountId={this.props.accountId} hideTabs />}
          alwaysPrepend
          append={remoteMessage}
          emptyMessage={emptyMessage}
          bindToDocument={!multiColumn}
        >
          {forceEmptyState ? [] : accountIds.map(id =>
            <AccountContainer key={id} id={id} withNote={false} />,
          )}
        </ScrollableList>
      </Column>
    );
  }

}

export default connect(mapStateToProps)(Following);
